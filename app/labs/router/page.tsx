"use client";

import { Suspense } from "react";
import DeviceCliLab, { type DeviceCliLabConfig } from "@/components/lab/DeviceCliLab";

const ROUTER_CONFIG: DeviceCliLabConfig = {
  initEndpoint: "/api/lab/router/init",
  execEndpoint: "/api/lab/router/exec",
  completeKind: "router",
  loadingText: "Racking your router…",
  consoleName: "Router console",
  historyPrompt: "Router#",
  inputPrompt: ">",
  loginHint: "Cisco ISR 1100 (IOS-XE). Type IOS commands — start with `enable`, then `configure terminal`.",
  lockedHint: "cable GI0/0 and GI0/1 first",
  inputPlaceholder: "configure terminal",
  completeMessage: "Branch routed — lab complete",
};

export default function RouterLabPage() {
  return (
    // useSearchParams needs a Suspense boundary on statically generated pages.
    <Suspense fallback={null}>
      <DeviceCliLab config={ROUTER_CONFIG} />
    </Suspense>
  );
}
