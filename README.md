# NEXORA AI — starter project

NEXORA is a web-first AI chatbot starter designed to be packaged for Android. It includes:
- AI text conversations through the OpenAI Responses API
- Image understanding (image attachments)
- Document analysis for supported PDF, Word, PowerPoint, Excel, CSV and text files
- Browser voice input (where supported) and read-aloud
- Language preference selector (including English, Nigerian Pidgin, Yoruba, Igbo and Hausa)
- Local chat history saved in the current browser/device
- Capacitor configuration for an Android app build

## Important: what is and isn't live yet

The interface and application code are included. AI replies require your own API key on the server. Voice input depends on browser/device speech-recognition support. Chat history is stored locally on that device; it is not yet synced across devices or user accounts. This starter does not include subscriptions, sign-in, moderation dashboard, or production hosting.

## 1. Requirements

- Node.js 20 or newer
- An OpenAI API key with API billing enabled
- A computer for development (Windows, macOS or Linux)

## 2. Run locally

1. Extract this ZIP.
2. Open a terminal in the `nexora-ai` folder.
3. Install packages:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env`.
5. Add your API key to `.env`:

   ```env
   OPENAI_API_KEY=your_real_key_here
   OPENAI_MODEL=gpt-5.5
   PORT=3000
   ```

6. Start NEXORA:

   ```bash
   npm run dev
   ```

7. Open `http://localhost:3000`.

**Never share your API key, commit `.env`, or put the key in browser JavaScript or an Android app.** The key must stay on the server.

## 3. Make it available on the internet

Deploy the Node app to a trusted Node hosting provider that supports environment variables and HTTPS. Set `OPENAI_API_KEY` and `OPENAI_MODEL` in the host's secret/environment settings. Do not upload `.env`.

Before public launch, add:
- User accounts and secure server-side chat storage
- Privacy policy, terms, data retention and account deletion
- Usage limits and cost monitoring per user
- Stronger file validation, malware scanning and abuse protection
- Backups, error monitoring and admin tools

## 4. Android build

The Android app needs the backend deployed first, because the API key must not be bundled in the app.

1. Deploy the backend and note its HTTPS URL.
2. Edit `public/config.js`:

   ```js
   window.NEXORA_CONFIG = {
     API_BASE_URL: "https://YOUR-BACKEND-DOMAIN"
   };
   ```

3. Install Android Studio and its Android SDK.
4. Run:

   ```bash
   npm install
   npx cap add android
   npx cap sync android
   npx cap open android
   ```

5. In Android Studio, test on a device/emulator and build a signed release APK/AAB when ready.

The Android project is generated locally by Capacitor; it is not included as a prebuilt APK in this starter ZIP.

## 5. Current capabilities and notes

- Images: common image formats supported by the model API.
- Documents: PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, CSV and text-like formats; per-file limit is 12 MB in this starter.
- Voice: browser speech recognition is not available in every browser. For a production-grade voice experience, add a dedicated audio transcription/speech service.
- Languages: the selector asks the AI to respond in the chosen language; quality varies by language and model.
- History: local to the browser/device. Clearing browser storage may remove it.

## Project structure

```text
nexora-ai/
  public/
    app.js
    config.js
    icon.svg
    index.html
    manifest.webmanifest
    styles.css
  capacitor.config.json
  package.json
  server.js
  .env.example
  .gitignore
  README.md
```

## Official API references

- OpenAI JavaScript quickstart: https://developers.openai.com/api/docs/quickstart
- Responses API file inputs: https://developers.openai.com/api/docs/guides/file-inputs
- Audio transcription guide: https://developers.openai.com/api/docs/guides/transcription
