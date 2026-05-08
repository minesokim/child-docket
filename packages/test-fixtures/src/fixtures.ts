// Stable test-fixture data.
//
// Every ID below is a hardcoded UUID — not generated at import time — so
// tests can assert against known values across runs. Names use the
// reserved `Tester` / `Fixture` / `Test` patterns to be unmistakably fake.
// SSN-shaped values use the IRS-reserved `000-XX-XXXX` block.
//
// Encryption note: `client_facts` and `intake_responses` rows in real prod
// have encrypted SSN/EIN/bank fields. The fixtures here ship the
// PLAINTEXT forms — the seed function wraps them with the tenant's DEK
// before insert. This keeps the fixture data legible in source while
// matching the at-rest schema.

import type { TenantId, ClientId, UserId, EngagementId } from '@docket/shared';

// ────────────────────────────────────────────────────────────────
// TENANT
// ────────────────────────────────────────────────────────────────

export const fixtureTenant = {
  id: '00000000-0000-4000-8000-000000000001' as TenantId,
  name: 'Test Fixture Tax Practice',
  slug: 'test-fixture-tax',
  timezone: 'America/Los_Angeles',
  defaultTrustLevel: '1' as const,
  bedrockEnabled: false,
  // Clerk org left null — fixture tenant is for non-auth tests
  clerkOrgId: null,
} as const;

// ────────────────────────────────────────────────────────────────
// USERS
//
// Three roles represented to exercise role-gated surfaces:
//   - firmOwner  → can sign 8879s, full admin
//   - preparer   → can prep + accept docs but not sign
//   - assistant  → read-only on most things, can upload docs
// ────────────────────────────────────────────────────────────────

export const fixtureUsers = {
  firmOwner: {
    id: '10000000-0000-4000-8000-000000000001' as UserId,
    tenantId: fixtureTenant.id,
    clerkUserId: 'user_test_fixture_firm_owner_001',
    email: 'firm-owner@test-fixture.example',
    name: 'Fixture FirmOwner',
    role: 'firm_owner' as const,
    avatarUrl: null,
  },
  preparer: {
    id: '10000000-0000-4000-8000-000000000002' as UserId,
    tenantId: fixtureTenant.id,
    clerkUserId: 'user_test_fixture_preparer_001',
    email: 'preparer@test-fixture.example',
    name: 'Fixture Preparer',
    role: 'preparer' as const,
    avatarUrl: null,
  },
  assistant: {
    id: '10000000-0000-4000-8000-000000000003' as UserId,
    tenantId: fixtureTenant.id,
    clerkUserId: 'user_test_fixture_assistant_001',
    email: 'assistant@test-fixture.example',
    name: 'Fixture Assistant',
    role: 'assistant' as const,
    avatarUrl: null,
  },
} as const;

// ────────────────────────────────────────────────────────────────
// CLIENTS
//
// Three taxpayer profiles with intentionally varied complexity so
// downstream tests (intake, classify, discovery, position) cover
// different fact-pattern shapes:
//
//   alice — single, W-2 employee, simple return. Vanilla case.
//   bob   — sole proprietor, Schedule C, multiple 1099-NECs. Tier-2
//           home-office position likely. Self-employment tax. Tests
//           Discovery agent's most common branches.
//   carol — married filing jointly, 2 dependents, mortgage interest,
//           rental property. Multi-source income. Tests cross-doc
//           reconciliation + multi-state attribution.
// ────────────────────────────────────────────────────────────────

export const fixtureClients = {
  alice: {
    id: '20000000-0000-4000-8000-000000000001' as ClientId,
    tenantId: fixtureTenant.id,
    clerkUserId: null, // unauthenticated fixture client
    fullName: 'Alice Tester',
    email: 'alice@test-fixture.example',
    phone: '+15550000001',
    state: 'CA',
    preferredLanguage: 'en' as const,
    intakeStatus: 'in-progress' as const,
    kycStatus: 'pending' as const,
  },
  bob: {
    id: '20000000-0000-4000-8000-000000000002' as ClientId,
    tenantId: fixtureTenant.id,
    clerkUserId: null,
    fullName: 'Bob Fixture',
    email: 'bob@test-fixture.example',
    phone: '+15550000002',
    state: 'CA',
    preferredLanguage: 'en' as const,
    intakeStatus: 'complete' as const,
    kycStatus: 'verified' as const,
  },
  carol: {
    id: '20000000-0000-4000-8000-000000000003' as ClientId,
    tenantId: fixtureTenant.id,
    clerkUserId: null,
    fullName: 'Carol Test',
    email: 'carol@test-fixture.example',
    phone: '+15550000003',
    state: 'CA',
    preferredLanguage: 'en' as const,
    intakeStatus: 'complete' as const,
    kycStatus: 'verified' as const,
  },
} as const;

// ────────────────────────────────────────────────────────────────
// ENGAGEMENTS
// One per client. Tax year 2025 to match current build context.
// ────────────────────────────────────────────────────────────────

export const fixtureEngagements = {
  aliceReturn: {
    id: '30000000-0000-4000-8000-000000000001' as EngagementId,
    tenantId: fixtureTenant.id,
    clientId: fixtureClients.alice.id,
    type: 'return_1040' as const,
    status: 'intake' as const,
    taxYear: 2025,
  },
  bobReturn: {
    id: '30000000-0000-4000-8000-000000000002' as EngagementId,
    tenantId: fixtureTenant.id,
    clientId: fixtureClients.bob.id,
    type: 'return_1040' as const,
    status: 'prep' as const,
    taxYear: 2025,
  },
  carolReturn: {
    id: '30000000-0000-4000-8000-000000000003' as EngagementId,
    tenantId: fixtureTenant.id,
    clientId: fixtureClients.carol.id,
    type: 'return_1040' as const,
    status: 'review' as const,
    taxYear: 2025,
  },
} as const;

// ────────────────────────────────────────────────────────────────
// INTAKE ANSWERS (PLAINTEXT — encrypt with tenant DEK at seed time)
//
// IRS reserves SSN block `000-XX-XXXX` for testing. We use those.
// Real test fixtures should NEVER use real-looking SSNs.
// ────────────────────────────────────────────────────────────────

export const fixtureIntakeAnswers = {
  alice: {
    personal: {
      fullName: 'Alice Tester',
      ssn: '000-00-0001',
      dob: '1990-04-15',
      filingStatus: 'single',
      address: {
        street: '123 Fake St',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
      },
    },
    income: {
      hasW2: true,
      w2Count: 1,
      hasSelfEmployment: false,
      hasRental: false,
    },
    deductions: {
      claimsHomeOffice: false,
      claimsMortgageInterest: false,
    },
  },
  bob: {
    personal: {
      fullName: 'Bob Fixture',
      ssn: '000-00-0002',
      dob: '1985-09-22',
      filingStatus: 'single',
      address: {
        street: '456 Test Ave',
        city: 'San Diego',
        state: 'CA',
        zip: '92101',
      },
    },
    income: {
      hasW2: false,
      hasSelfEmployment: true,
      selfEmploymentDescription: 'Freelance graphic design',
      // Multiple 1099-NEC clients — tests the "many income docs" path
      expected1099NecCount: 3,
      hasRental: false,
    },
    deductions: {
      claimsHomeOffice: true, // home office — Tier-2 position likely
      homeOfficeSqftPct: 12,
      homeOfficeUseExclusive: true,
      claimsMortgageInterest: false,
      hasBusinessVehicle: true,
      vehicleMethod: 'standard_mileage',
    },
  },
  carol: {
    personal: {
      fullName: 'Carol Test',
      ssn: '000-00-0003',
      dob: '1978-12-03',
      spouseFullName: 'Carl Test',
      spouseSsn: '000-00-0004',
      spouseDob: '1976-06-18',
      filingStatus: 'married_filing_jointly',
      address: {
        street: '789 Mock Blvd',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
      },
      dependentCount: 2,
      dependents: [
        { fullName: 'Carol Test Jr.', dob: '2015-03-12', ssn: '000-00-0005' },
        { fullName: 'Carl Test Jr.', dob: '2018-07-30', ssn: '000-00-0006' },
      ],
    },
    income: {
      hasW2: true,
      w2Count: 2, // both spouses W-2
      hasSelfEmployment: false,
      hasRental: true,
      rentalProperties: [
        {
          state: 'TX', // out-of-state rental — multi-state attribution
          rentReceived: 24000,
          expenses: 8500,
        },
      ],
    },
    deductions: {
      claimsHomeOffice: false,
      claimsMortgageInterest: true,
      mortgageInterestPaid: 18500,
      stateLocalTaxesPaid: 14000,
    },
    lifeEvents: {
      newDependent: false,
      jobChange: false,
    },
  },
} as const;

// ────────────────────────────────────────────────────────────────
// DOCUMENTS
//
// Five sample documents covering the doc-pipeline state machine:
//   - aliceDlFront     → parse_phase='final', binarized DL
//   - aliceDlBack      → parse_phase='final', merged into front
//   - bobW2            → parse_phase='final', binarized
//   - bob1099Nec       → parse_phase='accepted' (mid-finalize)
//   - carol1098T       → parse_phase='parsed' (awaiting verification)
//
// storageKey shape mirrors prod: `tenants/{tenantId}/clients/{clientId}/docs/{ulid}-{filename}`
// ────────────────────────────────────────────────────────────────

const docStorageKey = (clientId: string, ulid: string, filename: string): string =>
  `tenants/${fixtureTenant.id}/clients/${clientId}/docs/${ulid}-${filename}`;

export const fixtureDocuments = {
  aliceDlFront: {
    id: '40000000-0000-4000-8000-000000000001',
    tenantId: fixtureTenant.id,
    clientId: fixtureClients.alice.id,
    storageKey: docStorageKey(fixtureClients.alice.id, '01J5TESTDLFRONT', 'IMG_1001.png'),
    originalFilename: 'IMG_1001.png',
    mimeType: 'image/png' as const,
    sizeBytes: 67, // matches PLACEHOLDER_PNG_BYTES
    parsePhase: 'final' as const,
    aiClassification: 'drivers_license' as const,
    aiConfidence: 0.95,
    aiLegibility: 0.92,
    aiSuggestedFilename: 'DriversLicense_CA_2030exp.pdf',
    finalFilename: 'Alice_Tester_DriversLicenseFront_CA_2030exp.pdf',
    binarized: true,
    slotId: 'identity-dl-front',
  },
  aliceDlBack: {
    id: '40000000-0000-4000-8000-000000000002',
    tenantId: fixtureTenant.id,
    clientId: fixtureClients.alice.id,
    storageKey: docStorageKey(fixtureClients.alice.id, '01J5TESTDLBACK0', 'IMG_1002.png'),
    originalFilename: 'IMG_1002.png',
    mimeType: 'image/png' as const,
    sizeBytes: 67,
    parsePhase: 'final' as const,
    aiClassification: 'drivers_license' as const,
    aiConfidence: 0.93,
    aiLegibility: 0.91,
    aiSuggestedFilename: 'DriversLicense_CA_2030exp_back.pdf',
    finalFilename: 'Alice_Tester_DriversLicenseBack_CA_2030exp.pdf',
    binarized: true,
    slotId: 'identity-dl-back',
    // Merged into front in some test scenarios — exercise the merge path
    mergedIntoDocumentId: null as string | null,
  },
  bobW2: {
    id: '40000000-0000-4000-8000-000000000003',
    tenantId: fixtureTenant.id,
    clientId: fixtureClients.bob.id,
    storageKey: docStorageKey(fixtureClients.bob.id, '01J5TESTBOBW2000', 'W2_2025.png'),
    originalFilename: 'W2_2025.png',
    mimeType: 'image/png' as const,
    sizeBytes: 67,
    parsePhase: 'final' as const,
    aiClassification: 'w2' as const,
    aiConfidence: 0.97,
    aiLegibility: 0.94,
    aiSuggestedFilename: '2025_W-2_AcmeCorp.pdf',
    finalFilename: 'Bob_Fixture_2025_W-2_AcmeCorp.pdf',
    binarized: true,
    slotId: 'income-w2',
  },
  bob1099Nec: {
    id: '40000000-0000-4000-8000-000000000004',
    tenantId: fixtureTenant.id,
    clientId: fixtureClients.bob.id,
    storageKey: docStorageKey(fixtureClients.bob.id, '01J5TEST1099NEC0', '1099_NEC.png'),
    originalFilename: '1099_NEC.png',
    mimeType: 'image/png' as const,
    sizeBytes: 67,
    parsePhase: 'accepted' as const, // mid-finalize state
    aiClassification: '1099_nec' as const,
    aiConfidence: 0.91,
    aiLegibility: 0.88,
    aiSuggestedFilename: '2025_1099-NEC_FreelancePlatform.pdf',
    finalFilename: null,
    binarized: false,
    slotId: 'income-1099nec',
  },
  carol1098T: {
    id: '40000000-0000-4000-8000-000000000005',
    tenantId: fixtureTenant.id,
    clientId: fixtureClients.carol.id,
    storageKey: docStorageKey(fixtureClients.carol.id, '01J5TEST1098T000', '1098_T.png'),
    originalFilename: '1098_T.png',
    mimeType: 'image/png' as const,
    sizeBytes: 67,
    parsePhase: 'parsed' as const, // awaiting client verification
    aiClassification: '1098_t' as const,
    aiConfidence: 0.89,
    aiLegibility: 0.86,
    aiSuggestedFilename: '2025_1098-T_StateUniversity.pdf',
    finalFilename: null,
    binarized: false,
    slotId: 'deduct-1098t',
  },
} as const;
