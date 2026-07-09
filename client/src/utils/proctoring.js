// Single source of truth for proctoring violation reason labels.
// Two phrasings are intentional and used in different places:
//  - REASON_LABELS: short proper-case labels for the in-interview warning toast
//    ("Warning 2 of 3 — Phone detected").
//  - REASON_PHRASES: lowercase descriptive phrases for the terminated-report
//    sentence ("Detected: phone detected, another person in frame.").
export const REASON_LABELS = {
  "phone-detected": "Phone detected",
  "multiple-faces": "Another person detected",
  "no-face": "Face not visible",
  "looking-away": "Looking away from screen",
};

export const REASON_PHRASES = {
  "phone-detected": "phone detected",
  "multiple-faces": "another person in frame",
  "no-face": "candidate not visible",
  "looking-away": "looking away from screen",
  "tab-switch": "switched tab",
  "fullscreen-exit": "exited fullscreen",
  "window-blur": "switched window/app",
};
