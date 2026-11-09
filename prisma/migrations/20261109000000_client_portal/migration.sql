-- Danışan hesabı (Hesabım): hesaplar, oturumlar, bağlantı tokenları, danışana mesajlar, dosya görünürlüğü.

-- CreateEnum
CREATE TYPE "ClientTokenPurpose" AS ENUM ('ACTIVATE', 'RESET');

-- AlterTable
ALTER TABLE "client_files" ADD COLUMN "visibleToClient" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "client_accounts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "lastLoginAt" TIMESTAMPTZ(3),
    "passwordChangedAt" TIMESTAMPTZ(3),
    "activatedAt" TIMESTAMPTZ(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "client_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_account_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "purpose" "ClientTokenPurpose" NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_account_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfToken" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "remember" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_messages" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "authorId" TEXT,
    "contentEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "client_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_accounts_clientId_key" ON "client_accounts"("clientId");
CREATE UNIQUE INDEX "client_accounts_email_key" ON "client_accounts"("email");
CREATE UNIQUE INDEX "client_account_tokens_tokenHash_key" ON "client_account_tokens"("tokenHash");
CREATE INDEX "client_account_tokens_accountId_idx" ON "client_account_tokens"("accountId");
CREATE UNIQUE INDEX "client_sessions_tokenHash_key" ON "client_sessions"("tokenHash");
CREATE INDEX "client_sessions_accountId_idx" ON "client_sessions"("accountId");
CREATE INDEX "client_sessions_expiresAt_idx" ON "client_sessions"("expiresAt");
CREATE INDEX "client_messages_clientId_idx" ON "client_messages"("clientId");

-- AddForeignKey
ALTER TABLE "client_accounts" ADD CONSTRAINT "client_accounts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_accounts" ADD CONSTRAINT "client_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_account_tokens" ADD CONSTRAINT "client_account_tokens_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_sessions" ADD CONSTRAINT "client_sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_messages" ADD CONSTRAINT "client_messages_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_messages" ADD CONSTRAINT "client_messages_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_messages" ADD CONSTRAINT "client_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Danışan hesabı yönetimi yalnızca yönetici rolüne verilir (seed çalıştırılmadan mevcut kurulumda da geçerli olsun)
UPDATE "roles" SET "permissions" = array_append("permissions", 'portal:manage')
WHERE "key" = 'ADMIN' AND NOT ('portal:manage' = ANY("permissions"));
