import { Suspense } from "react";
import { OnboardingScreen } from "../app/components/OnboardingScreen";

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingScreen />
    </Suspense>
  );
}
