# ДЗ 14 — Push-сповіщення у Prostir: що зроблено і що залишилось зробити вам

## Що вже реалізовано в коді

| Файл | Зміни |
|---|---|
| `convex/schema.ts` | `users.pushToken`, `users.mutedRooms` (бонус), індекс `by_push_token` |
| `convex/users.ts` | `savePushToken`, `removePushToken`, `clearInvalidPushToken` (internal), `toggleMuteRoom` (бонус) |
| `convex/pushNotifications.ts` | **новий**: `internalAction sendPushNotification` + хелпери `notifyNewMessage`, `notifyReaction` |
| `convex/messages.ts` | пуші в `sendMessage`, `sendMediaMessage` (📷), `sendAudioMessage` (🎤), `sendVideoNoteMessage` (📹) |
| `convex/reactions.ts` | пуш автору при **додаванні** реакції (не при знятті і не на власне повідомлення) |
| `src/hooks/usePushNotifications.ts` | **новий**: канал Android, дозвіл, токен → Convex, foreground-handler, deep link у `/chat/[id]` (фон + холодний старт) |
| `src/components/InitialLayout.tsx` | виклик `usePushNotifications()` |
| `src/app/chat/[id].tsx` | кнопка 🔔/🔕 у шапці — вимкнути сповіщення кімнати (бонус) |
| `src/app/(tabs)/profile.tsx` | при виході токен відв'язується від акаунта |
| `app.config.ts` | плагін `expo-notifications`, `VIBRATE` + `POST_NOTIFICATIONS`, `googleServicesFile`, `extra.eas.projectId` |
| `package.json` | `expo-notifications ~57.0.23` |

Відмінності від інструкції (бо у вашому проєкті інша структура):
- маршрут чату — `/chat/[id]`, а не `/(app)/chat/[id]`;
- ім'я користувача — `fullname || username || email` (у схемі немає `name`);
- Reply-автор отримує **лише** персональний пуш, без дубля «нове повідомлення»;
- якщо ви зараз у цій самій кімнаті — банер у foreground не показується;
- бонуси: mute кімнати + скидання бейджа при відкритті додатка.

## Кроки, які потрібно зробити вам

### 1. Встановити залежності та задеплоїти Convex
```bash
npm install
npx convex dev        # перегенерує convex/_generated і задеплоїть функції
```

### 2. EAS projectId
```bash
npx eas-cli@latest login
npx eas-cli@latest init
```
`eas init` з динамічним `app.config.ts` не може сам записати ID — він покаже його у терміналі. Додайте в `.env.local`:
```
EAS_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 3. Firebase (FCM v1)
1. [Firebase Console](https://console.firebase.google.com/) → Add project → додати **Android**-додаток.
2. **Package name** має точно збігатися з тим, що ви збираєте:
   - APK з ДЗ 13 (`APP_ENV=preview`/`production`) → `com.prostir.app`
   - dev-збірка (без `APP_ENV`) → `com.prostir.app.dev`
   (Можна додати обидва Android-додатки в один Firebase-проєкт — тоді `google-services.json` міститиме обидва.)
3. Завантажте `google-services.json` у **корінь проєкту** (поруч із `app.config.ts`).
4. Project settings → Service accounts → **Generate new private key**.
5. `https://expo.dev/accounts/<акаунт>/projects/prostir/credentials` → Android → ваш package → **FCM V1 service account key** → Upload JSON.
   (Або `npx eas-cli@latest credentials` → Android → Push Notifications: FCM V1.)

> ⚠️ Ключ service account і `google-services.json` не комітьте в публічний репозиторій.

### 4. Перезібрати нативний проєкт (обов'язково — додано нативний модуль)
```bash
APP_ENV=preview npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease     # або assembleDebug
```
У Windows PowerShell: `$env:APP_ENV="preview"; npx expo prebuild --platform android --clean`.
Expo Go для пушів на Android **не підходить**.

### 5. Тестування
1. Встановіть APK, увійдіть, дозвольте сповіщення.
2. Convex Dashboard → Data → `users` → поле `pushToken = ExponentPushToken[...]` → **скріншот 1**.
3. [expo.dev/notifications](https://expo.dev/notifications): токен, Title, Message, Data `{"roomId":"<id кімнати>"}` → має прийти банер.
4. Два акаунти (телефон + емулятор з Google Play): на телефоні згорніть додаток, з іншого акаунта напишіть у спільну кімнату → **скріншот 2** шторки.
5. Запишіть відео: згорнуто → пуш → тап → відкривається потрібний чат → **відео до 30 с**.
6. Перевірте також: Reply (пуш з цитатою), реакцію, 🔕 у шапці чату (пуші з кімнати перестають приходити).

> Хто отримує пуші: творець кімнати + усі, хто вже писав у ній (окремої таблиці учасників у проєкті немає).

## Типові проблеми
- **У консолі «Немає extra.eas.projectId»** — не додано `EAS_PROJECT_ID` у `.env.local` (крок 2), перезапустіть збірку.
- **Токен є, але пуші не приходять** — не завантажено FCM V1 ключ в Expo (крок 3.5) або package name у Firebase ≠ package збірки. Подивіться логи `sendPushNotification` у Convex Dashboard → Logs: там видно відповідь Expo.
- **`Default FirebaseApp is not initialized`** — бракує `google-services.json` у корені під час `prebuild`.
- **Android 13+ без запиту дозволу** — після зміни конфігу не зробили `prebuild --clean`.

## Шаблон звіту
- Пристрій: ______ (Android __)
- Пуші при вимкненому екрані: так/ні; при закритому додатку: так/ні
- Труднощі та рішення: ______
