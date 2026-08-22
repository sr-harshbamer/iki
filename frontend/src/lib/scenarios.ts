import type { AnalyzeMode } from "@/components/ModeTabs";

export interface AttackScenario {
  id: string;
  label: string;
  category: string;
  description: string;
  mode: AnalyzeMode;
  content: string;
  /** Tags this scenario against a pre-seeded sender history, so anomaly
   * detection can fire for real instead of scoring the message in isolation. */
  senderId?: string;
}

export const ATTACK_SCENARIOS: AttackScenario[] = [
  {
    id: "family",
    label: "Family Impersonation",
    category: "Voice/message claiming to be a relative",
    description:
      "“Hey beta, I'm stuck at the airport... I need ₹35,000 urgently... Don't call me.”",
    mode: "message",
    content:
      "Hey beta, I'm stuck at the airport. My phone is about to die. I need 35,000 rupees urgently. Please transfer it now to this account. Don't call me, I can't talk right now.",
    senderId: "sim-dad",
  },
  {
    id: "bank",
    label: "Bank Impersonation",
    category: "Fake bank security alert",
    description:
      "“This is your bank security team. Verify your OTP immediately or your account will be frozen.”",
    mode: "message",
    content:
      "This is your bank security team. Your account has been compromised. Verify your OTP immediately or your account will be frozen.",
  },
  {
    id: "hr",
    label: "Fake HR",
    category: "Employer refund scam",
    description:
      "“We accidentally processed your salary twice. Please return ₹18,000 immediately. Do not contact payroll.”",
    mode: "message",
    content:
      "Hi, this is HR. We accidentally processed your salary twice this month. Please return 18,000 rupees immediately to the account below. Do not contact payroll about this.",
  },
  {
    id: "safe",
    label: "Ordinary Message",
    category: "Baseline: no attack",
    description: "“Hey, are you free for dinner tonight?”",
    mode: "message",
    content: "Hey, are you free for dinner tonight?",
  },
];

/** Baseline messages used to pre-seed "sim-dad"'s history before the Family
 * Impersonation scenario runs, so its anomaly signal is a real comparison
 * against real history -- not a scripted number. */
export const SIM_DAD_BASELINE = [
  "Beta, reached home safely. Take care and eat properly.",
  "Haan beta, all good here. Call me when you're free, no rush.",
  "Theek hai, see you this weekend then. Drive safe.",
];
