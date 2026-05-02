// Welcome - first auth'd page after sign-in.
//
// The (intake) layout has already provisioned the client + intake_responses
// row and seeded the IntakeProvider with the loaded answers. So this page
// is a thin wrapper - actual logic lives in <WelcomeContent /> which reads
// state via useIntakeAnswers + getResumeStep to decide first-time vs resume.

import { WelcomeContent } from './content';

export default function WelcomePage() {
  return <WelcomeContent />;
}
