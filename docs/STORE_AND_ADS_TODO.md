# Hush Garden — 스토어 출시 · 광고 · 백그라운드 남은 작업 가이드

이 문서는 **이후 다른 에이전트나 개발자가 이어서 바로 작업할 수 있도록** 현재까지 구현된 내용과 앞으로 남은 작업을 정리한 인수인계 문서입니다.

---

## 1. 이미 구현되어 있는 것

### 앱 빌드 & 백그라운드 / 플로팅 버블
- **Expo / EAS 설정**:
  - `app.config.js`: Android `package: "com.jaces.hushgarden"`, iOS `bundleIdentifier: "com.jaces.hushgarden"`, `ITSAppUsesNonExemptEncryption: false`, `NSUserTrackingUsageDescription`, `react-native-audio-api` (`iosBackgroundMode: true`, `androidForegroundService: true`, `mediaPlayback`).
  - `eas.json`: `development`, `preview` (Android APK / iOS 실기기), `production` (Android AAB / iOS) 프로필.
  - `scripts/build-android.mjs`, `scripts/build-ios.mjs` (`npm run build:android`, `npm run build:ios`).
- **Android 플로팅 버블 + 포그라운드 서비스**:
  - `plugins/with-floating-bubble.cjs` + `plugins/android/FloatingBubbleService.kt`, `FloatingBubbleModule.kt`, `FloatingBubblePackage.kt`
  - `src/audio/floatingBubble.ts` + `src/components/Panels.tsx` 설정 UI (`플로팅 버블`)
  - `:app:compileReleaseKotlin` 컴파일 통과 확인됨.

### 하단 배너 광고 뼈대
- **네이티브 (Android / iOS)**: `src/components/AdBanner.tsx`
  - `react-native-google-mobile-ads` (`ANCHORED_ADAPTIVE_BANNER`) 연동.
  - 환경변수 미설정 시 **Google 공식 테스트 ID** 사용 (`app.config.js` 포함).
- **웹**: `src/components/AdBanner.web.tsx`
  - `EXPO_PUBLIC_ADSENSE_CLIENT`, `EXPO_PUBLIC_ADSENSE_SLOT`이 설정될 때만 Google AdSense 배너를 표시하고, 미설정 시 렌더링하지 않음.
- **레이아웃**: `src/screens/Game.tsx`
  - 정원 캔버스/에디터(`flex: 1`) 아래 전용 하단 바에 배치되며, 모달(`panel`, `askNature`) 및 동의/입장/중복접속 차단 화면에서는 자동으로 숨김.

### 심사/정책용 콘텐츠 페이지 (`jace-s` 웹)
- `services/web/src/pages/HushGardenGuidePage.tsx` (`/hush-garden/guide`)
- `services/web/src/pages/HushGardenPrivacyPage.tsx` (`/hush-garden/privacy`)
- Hush Garden 설정(`src/components/Panels.tsx`)에 `가이드`, `개인정보처리방침` 링크 연결됨.

---

## 2. 사용자(개발자)가 직접 준비해야 할 항목

1. **Google AdMob 계정 & ID 발급**
   - Android 앱 등록 → App ID (`EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`), 배너 단위 ID (`EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID`)
   - iOS 앱 등록 → App ID (`EXPO_PUBLIC_ADMOB_IOS_APP_ID`), 배너 단위 ID (`EXPO_PUBLIC_ADMOB_IOS_BANNER_ID`)
2. **(웹 광고 시) Google AdSense 심사 신청 & 슬롯 발급**
   - `EXPO_PUBLIC_ADSENSE_CLIENT` (`ca-pub-...`), `EXPO_PUBLIC_ADSENSE_SLOT`
   - `https://hush-garden.jace-s.com/ads.txt` 및 `https://jace-s.com/app-ads.txt` 내용 확보
3. **스토어 계정 및 서명**
   - Google Play Console 개발자 계정 + Android 릴리스 서명 키(EAS 자동 관리 또는 로컬 keystore)
   - Apple Developer Program 계정 (연 $99) + Bundle ID `com.jaces.hushgarden` 등록
4. **리포지토리 비공개 전환 권장**
   - 상용 스토어 출시 전 GitHub `hush-garden` / `jace-s` 리포지토리를 Private으로 전환 권장.

---

## 3. 이후 에이전트에게 시킬 남은 기술 작업

아래 순서대로 에이전트에게 요청하면 됩니다.

1. **실제 광고 ID 및 `ads.txt` / `app-ads.txt` 연결**
   - 우선 모바일 앱(AdMob)부터 EAS Secrets / `.env`에 `EXPO_PUBLIC_ADMOB_*` 값을 등록. (웹 `EXPO_PUBLIC_ADSENSE_*`는 Cloudflare Pages 이전 전까지 Vercel Hobby에 넣지 않고 비워둠 — Hobby 플랜은 비상업 전용)
   - `services/hush-garden/public/ads.txt` 및 `services/web/public/app-ads.txt` 추가.
2. **웹 정식 출시 및 AdSense 적용 시 Cloudflare Pages로 이전**
   - Vercel Hobby(비상업 전용)에서 **Cloudflare Pages**로 웹 호스팅 이전 (무제한 대역폭·상업 이용/광고 허용).
   - 커스텀 도메인(예: `hush-garden.jace-s.com`) 연결 후 AdSense 심사 진행.
   - GitHub Actions에서 `npm run export:web` 빌드 후 `wrangler pages deploy dist`(Direct Upload)로 배포해 Cloudflare Pages Git 빌드 횟수 제한(월 500회)을 소모하지 않도록 구성.
   - Cloudflare Pages 환경변수에 `EXPO_PUBLIC_ADSENSE_CLIENT`, `EXPO_PUBLIC_ADSENSE_SLOT` 등록.
3. **iOS ATT(앱 추적 투명성) & GDPR(UMP) 동의 팝업 연동**
   - `expo-tracking-transparency` 또는 `react-native-google-mobile-ads`의 `AdsConsent.requestInfoUpdate()`를 앱 시작/배너 초기화 전에 호출하도록 `AdBanner.tsx` 보완.
4. **실기기 백그라운드 오디오 안정화 점검**
   - Android/iOS 실기기에서 화면을 끈 채 30분 이상 재생 테스트:
     - `NoiseStream` (`src/audio/engine.ts`)과 `NaturePlayer` (`src/audio/naturePlayer.ts`)가 백그라운드 JS 타이머 스로틀링으로 끊기는지 확인.
     - 끊김이 확인되면 `NoiseStream`을 네이티브 오디오 스레드(C++ / Kotlin / Swift `AVAudioSourceNode`)로 이전.
   - Android 실기기에서 `플로팅 버블` 권한 허용, 드래그 스냅, 단일 탭 재생/일시정지, 더블탭 앱 복귀, `×` 닫기 동작 확인.
5. **스토어 빌드 및 제출**
   - `npx eas build -p android --profile preview`로 APK 테스트 후 `npx eas build -p all --profile production`으로 스토어용 `.aab` / `.ipa` 빌드 및 제출.
