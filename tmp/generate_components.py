"""
Generate React components from the donedone SVGs (user-edited Adobe Illustrator
exports, single icon per file).

Per icon:
  1. Read bruh2-NN.svg
  2. Strip Adobe junk: DOCTYPE, comments, xmlns:xlink, x/y attrs,
     enable-background, xml:space, id="Layer_1"
  3. KEEP exact colors as-is (user's editing decision)
  4. Convert XML kebab-case attrs to JSX camelCase
     (fill-rule -> fillRule, stroke-width -> strokeWidth, etc.)
  5. Wrap each SVG inner content in a React function component
  6. Write a single packages/ui/src/icons/solar.tsx
"""

import os
import re
from pathlib import Path

SRC_DIR = r"C:\Users\minse\OneDrive\Desktop\donedone"
OUT_FILE = "packages/ui/src/icons/solar.tsx"

# bruh2-NN.svg -> (Component name, comment for inventory)
ICON_MAP = [
    ("bruh2-01.svg", "SolarPersonalReturn",       "Personal tax return (services)"),
    ("bruh2-02.svg", "SolarSelfEmployed",         "Self-employed return (services)"),
    ("bruh2-03.svg", "SolarBusiness",             "Business return (services)"),
    ("bruh2-04.svg", "SolarConsultation",         "Something else / consultation (services)"),
    ("bruh2-05.svg", "SolarW2Wages",              "W-2 wages (income)"),
    ("bruh2-06.svg", "SolarSelfEmploymentIncome", "Self-employment income (income)"),
    ("bruh2-07.svg", "SolarRentalProperty",       "Rental property (income)"),
    ("bruh2-08.svg", "SolarInterestIncome",       "Interest income (income)"),
    ("bruh2-09.svg", "SolarDividends",            "Dividends (income)"),
    ("bruh2-10.svg", "SolarRetirement",           "Retirement / pension (income)"),
    ("bruh2-11.svg", "SolarSocialSecurity",       "Social Security (income)"),
    ("bruh2-12.svg", "SolarUnemployment",         "Unemployment (income)"),
    ("bruh2-13.svg", "SolarBusinessName",         "Business name (self-employment)"),
    ("bruh2-14.svg", "SolarOccupation",           "Occupation (self-employment)"),
    ("bruh2-15.svg", "SolarExpenses",             "Expenses (self-employment)"),
    ("bruh2-16.svg", "SolarForeignAccounts",      "Foreign accounts (tax questions)"),
    ("bruh2-17.svg", "SolarCrypto",               "Crypto / digital assets (tax questions)"),
    ("bruh2-18.svg", "SolarHealthInsurance",      "Health insurance (tax questions)"),
    ("bruh2-19.svg", "SolarMortgageInterest",     "Mortgage interest (deductions)"),
    ("bruh2-20.svg", "SolarStudentLoan",          "Student loan (deductions)"),
    ("bruh2-21.svg", "SolarCharity",              "Charity (deductions)"),
    ("bruh2-22.svg", "SolarChildcare",            "Childcare (deductions)"),
    ("bruh2-23.svg", "SolarMedical",              "Medical (deductions)"),
    ("bruh2-24.svg", "SolarEducation",            "Education (deductions)"),
    ("bruh2-25.svg", "SolarEducator",             "Educator (deductions)"),
    ("bruh2-26.svg", "SolarMarriage",             "Marriage (life events)"),
    ("bruh2-27.svg", "SolarHomePurchase",         "Home purchase (life events)"),
    ("bruh2-28.svg", "SolarNewChild",             "New child (life events)"),
    ("bruh2-29.svg", "SolarDivorce",              "Divorce (life events)"),
    ("bruh2-30.svg", "SolarJobChange",            "Job change (life events)"),
    ("bruh2-31.svg", "SolarMovedStates",          "Moved states (life events)"),
    ("bruh2-32.svg", "SolarDeathOfSpouse",        "Death of spouse (life events)"),
    # bruh3 batch — added May 2026
    ("bruh2-33.svg", "SolarOvertimePay",          "Overtime pay (tax questions)"),
    ("bruh2-34.svg", "SolarNoneOfThese",          "None of these (shared, deductions + life events)"),
    ("bruh2-35.svg", "SolarVehicle",              "Vehicle for business (self-employment)"),
    ("bruh2-36.svg", "SolarRetired",              "Retired (life events)"),
    ("bruh2-37.svg", "SolarHomeOffice",           "Home office (self-employment)"),
    ("bruh2-38.svg", "SolarTips",                 "Tips earned at work (tax questions)"),
    ("bruh2-39.svg", "SolarBusinessStarted",      "Started a business (life events)"),
    ("bruh2-40.svg", "SolarInheritance",          "Received an inheritance (life events)"),
    ("bruh2-41.svg", "SolarEstimatedTax",         "Estimated tax payments (tax questions)"),
    ("bruh2-42.svg", "SolarCashDocumentation",    "Cash revenue documentation (self-employment)"),
    ("bruh2-43.svg", "SolarInPersonPin",          "In-person location pin (appt format)"),
]


# XML attribute -> JSX camelCase
ATTR_RENAMES = {
    'fill-rule': 'fillRule',
    'clip-rule': 'clipRule',
    'stroke-width': 'strokeWidth',
    'stroke-linecap': 'strokeLinecap',
    'stroke-linejoin': 'strokeLinejoin',
    'stroke-miterlimit': 'strokeMiterlimit',
    'stroke-dasharray': 'strokeDasharray',
    'stroke-opacity': 'strokeOpacity',
    'fill-opacity': 'fillOpacity',
    'stop-color': 'stopColor',
    'stop-opacity': 'stopOpacity',
    'clip-path': 'clipPath',
    'enable-background': None,   # drop
    'xml:space': None,            # drop
    'xmlns:xlink': None,          # drop
}


def parse_svg(text: str) -> tuple[str, str]:
    """Return (viewBox attribute string, inner content). Strips Adobe
    junk along the way. Preserves all path data + colors verbatim."""
    # Drop XML declaration, DOCTYPE, comments
    text = re.sub(r'<\?xml[^?]*\?>', '', text)
    text = re.sub(r'<!DOCTYPE[^>]*>', '', text)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)

    # Extract viewBox
    m = re.search(r'<svg([^>]*)>(.*?)</svg>', text, flags=re.DOTALL)
    if not m:
        raise ValueError("No <svg>...</svg> found")
    svg_attrs, inner = m.group(1), m.group(2)
    vb_m = re.search(r'viewBox="([^"]*)"', svg_attrs)
    view_box = vb_m.group(1) if vb_m else "0 0 256 256"

    # JSX-rename attrs in the inner content
    def rename_attr(m: 're.Match[str]') -> str:
        attr_name = m.group(1)
        rest = m.group(0)[len(attr_name):]
        if attr_name in ATTR_RENAMES:
            replacement = ATTR_RENAMES[attr_name]
            if replacement is None:
                # Drop the attr entirely. The full match is `attr="value"`,
                # so we replace with empty string.
                return ''
            return replacement + rest
        return m.group(0)

    # Match: attr="val" or attr='val'
    inner = re.sub(
        r'\b([\w:-]+)="[^"]*"',
        lambda m: handle_attr(m),
        inner,
    )

    # Trim whitespace
    inner = inner.strip()
    return view_box, inner


def handle_attr(m: 're.Match[str]') -> str:
    full = m.group(0)
    attr_name = m.group(1)
    if attr_name in ATTR_RENAMES:
        replacement = ATTR_RENAMES[attr_name]
        if replacement is None:
            return ''  # drop the attr
        # Keep the value, swap the name
        rest = full[len(attr_name):]
        return replacement + rest
    return full


def make_component(name: str, view_box: str, inner: str, comment: str) -> str:
    return f"""
/** {comment} */
export function {name}({{ size = 32 }}: IconProps) {{
  return (
    <svg width={{size}} height={{size}} viewBox="{view_box}" fill="none" xmlns="http://www.w3.org/2000/svg">
      {inner}
    </svg>
  );
}}
"""


def main() -> None:
    parts = ["""// Solar Line Duotone icons for Docket — vendored from user-edited
// Adobe Illustrator SVG exports (one icon per file).
//
// Pipeline (see tmp/generate_components.py):
//   1. Read each bruh2-NN.svg from the user's editing folder
//   2. Strip Adobe metadata (DOCTYPE, xmlns:xlink, x/y attrs,
//      enable-background, xml:space, id="Layer_1")
//   3. KEEP the user's exact colors (#183E1E forest, #CCE7CF mint, etc.)
//   4. Convert XML kebab-case attrs to JSX camelCase
//   5. Wrap inner content in a React component with a `size` prop
//
// To regenerate after editing any source SVG: drop the new file in
// C:\\Users\\minse\\OneDrive\\Desktop\\donedone with the same name and
// re-run python tmp/generate_components.py.

import * as React from 'react';

type IconProps = { size?: number };
"""]

    for fn, name, comment in ICON_MAP:
        path = os.path.join(SRC_DIR, fn)
        if not os.path.exists(path):
            print(f"  SKIP {fn} (not found)")
            continue
        with open(path, 'r', encoding='utf-8') as f:
            text = f.read()
        try:
            view_box, inner = parse_svg(text)
        except ValueError as e:
            print(f"  ERROR {fn}: {e}")
            continue
        parts.append(make_component(name, view_box, inner, comment))
        print(f"  [OK] {fn} -> {name}")

    out = "\n".join(parts).strip() + "\n"
    Path(OUT_FILE).parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        f.write(out)

    print(f"\nWrote {OUT_FILE} ({os.path.getsize(OUT_FILE)} bytes)")


if __name__ == "__main__":
    main()
