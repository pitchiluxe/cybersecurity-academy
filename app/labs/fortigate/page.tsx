"use client";

import { Suspense } from "react";
import DeviceCliLab, { type DeviceCliLabConfig } from "@/components/lab/DeviceCliLab";

const FORTIGATE_CONFIG: DeviceCliLabConfig = {
  initEndpoint: "/api/lab/fortigate/init",
  execEndpoint: "/api/lab/fortigate/exec",
  completeKind: "fortigate",
  loadingText: "Unboxing your FortiGate…",
  consoleName: "FortiGate console",
  historyPrompt: "FortiGate-60F #",
  inputPrompt: "#",
  loginHint: "FortiGate-60F login: admin (no password). Type FortiOS commands.",
  lockedHint: "cable WAN1 and LAN1 first",
  inputPlaceholder: "config system interface",
  completeMessage: "Branch online — lab complete",
};

export default function FortigateLabPage() {
  return (
    // useSearchParams needs a Suspense boundary on statically generated pages.
    <Suspense fallback={null}>
      <DeviceCliLab config={FORTIGATE_CONFIG} />
    </Suspense>
  );
}
