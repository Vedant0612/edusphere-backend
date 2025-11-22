# Commands to Run

## 1. Start Docker services (database, etc.)
```powershell
docker compose up -d
```

## 2. Install Node dependencies (first setup only)
```powershell
npm install
```

## 3. Apply Prisma migrations to keep the DB schema in sync
```powershell
npx prisma migrate dev --name init
```

## 4. Generate the Prisma Client after schema changes
```powershell
npx prisma generate
```

## 5. Inspect data with Prisma Studio
```powershell
npx prisma studio ./prisma.config.js
```

## 6. Start the Express API server (example using port 8000)
```powershell
$env:PORT=8000; node src/server.js
```

