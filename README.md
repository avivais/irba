# IRBA Manager

מערכת ניהול לאילון רמון כדורסל — הרשמה לאימונים (MVP).

## דרישות

- Node.js 20+
- Docker (אופציונלי, ל-PostgreSQL ולפריסה)

## הגדרה מקומית

1. העתק `.env.example` ל-`.env` ועדכן סיסמאות ו-`RSVP_SESSION_SECRET` (לפחות 32 תווים).

2. הרץ PostgreSQL:

   ```bash
   docker compose up -d db
   ```

3. החל סכמה והפעל seed (אופציונלי):

   ```bash
   npm install
   npx prisma migrate deploy
   npm run db:seed
   ```

   (יש מיגרציה ראשונית ב-`prisma/migrations/`; `migrate deploy` מתאים לסביבות קיימות, `migrate dev` לפיתוח עם שינויי סכמה.)

4. פתח את האפליקציה:

   ```bash
   npm run dev
   ```

   פתח [http://localhost:3000](http://localhost:3000).

### `DATABASE_URL`

- **פיתוח עם DB בדוקר על המחשב:** `postgresql://USER:PASSWORD@localhost:5432/DB`
- **אפליקציה בתוך Docker Compose:** השתמש ב-hostname `db` במקום `localhost`.

## Docker — אפליקציה + DB

```bash
export RSVP_SESSION_SECRET="your-long-random-secret-at-least-32-chars"
docker compose up --build
```

האפליקציה תרוץ על פורט 3000; לפני `next start` רצים `prisma migrate deploy` (ראה `docker-entrypoint.sh`).

## סקריפטים

| פקודה | תיאור |
|--------|--------|
| `npm run dev` | שרת פיתוח |
| `npm run build` | בנייה |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` (ייצור) |
| `npm run db:seed` | נתוני דוגמה |

## אבטחה

- אין לשמור סודות בקוד; השתמש ב-`.env` (לא בקומיט).
- `RSVP_SESSION_SECRET` חותם על עוגיית ההרשמה (HTTP-only).
