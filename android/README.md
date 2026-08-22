# SuSagi Voice Guard (Android)

A real native Android app -- not the browser mic demo -- that monitors
**real phone calls while they're on speakerphone** and cross-references what's
being said against a trusted contact's behavioral baseline, using the exact
same backend pipeline (`Vosk` transcription, lexicon scoring, and the
Behavioral Impersonation Engine's Gemini cross-reference) as the web app's
`/susagi` Voice Guard page. No backend changes were needed -- this is just
another client of `/api/behavioral-profiles` and `/api/ws/call-stream`.

## The one hard constraint, stated plainly

No app -- this one included -- can read the other party's audio on a normal
cellular call. Android never exposes that stream to third-party apps. What
*is* readable is the phone's own microphone, which only picks up the other
party's voice when the call is on speakerphone. `CallMonitorService` only
ever captures audio while `AudioManager.isSpeakerphoneOn()` is true, and
stops the instant it isn't.

Recording a call may require the other party's consent depending on where
you are -- that's on you to check before using this on a real call with
someone else.

## Build

```
cd android
./gradlew assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`. Sideload it (Play Store
review wouldn't finish before a hackathon deadline, and Play restricts
call-related apps from public listing anyway) -- enable "install unknown
apps" for whatever app you transfer the APK with.

This was built and verified to compile in an environment with no Android
emulator or physical device attached -- `assembleDebug` succeeding confirms
the app is real, correct Kotlin that produces a valid APK, but the actual
on-device behavior (does `PhoneStateListener` fire correctly on your specific
OEM's dialer, does the mic really pick up your speaker at a workable volume)
needs verifying on a real phone, which only you can do.

## Using it

1. Install the APK, open it.
2. Enter your backend's URL (the same one the web app's `.env.local` points
   at -- a Cloudflare tunnel URL if testing over the internet, or your PC's
   LAN IP if on the same WiFi).
3. Tap "Load trusted contacts" -- pulls the same profiles
   (`/api/behavioral-profiles`) the web app uses.
4. Pick who you're expecting a call from, tap "Start Voice Guard".
5. Grant microphone, phone-state, and notification permissions when asked.
6. Make or receive a call and switch it to speakerphone -- monitoring starts
   automatically. A high-priority notification fires if the live score or
   the behavioral cross-reference crosses a critical threshold, since you
   won't be looking at the app mid-call.

## What's deliberately not here

- No Play Store listing / signing config for release builds -- this is a
  demo APK, not a shipped product.
- No emulator system image was installed in the dev environment (disk
  constraints, and it wouldn't prove anything a real phone doesn't).
- No UI polish pass to match the web app's dark theme pixel-for-pixel --
  functional Compose UI using the same color tokens, not a design pass.
