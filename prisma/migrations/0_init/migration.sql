-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'TELECALLER', 'SALESMAN') NOT NULL,
    `phone` VARCHAR(30) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    `lockoutUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `lastActiveAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_isActive_idx`(`role`, `isActive`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` VARCHAR(36) NOT NULL,
    `tokenHash` VARCHAR(128) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `replacedByTokenHash` VARCHAR(128) NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` TEXT NULL,

    UNIQUE INDEX `RefreshToken_tokenHash_key`(`tokenHash`),
    INDEX `RefreshToken_userId_idx`(`userId`),
    INDEX `RefreshToken_tokenHash_idx`(`tokenHash`),
    INDEX `RefreshToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` VARCHAR(36) NOT NULL,
    `companyName` VARCHAR(150) NOT NULL,
    `serviceProduct` VARCHAR(150) NOT NULL,
    `contactPerson` VARCHAR(100) NULL,
    `phone` VARCHAR(30) NOT NULL,
    `email` VARCHAR(100) NULL,
    `alternatePhone` VARCHAR(30) NULL,
    `website` VARCHAR(255) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `pipelineStage` VARCHAR(50) NOT NULL DEFAULT 'New Lead',
    `salesStage` VARCHAR(50) NULL,
    `callAttempts` INTEGER NOT NULL DEFAULT 0,
    `isRetry` BOOLEAN NOT NULL DEFAULT false,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `lastCallOutcome` VARCHAR(50) NULL,
    `lastContactDate` DATETIME(3) NULL,
    `lastStatusUpdatedAt` DATETIME(3) NULL,
    `nextFollowUpDate` DATETIME(3) NULL,
    `nextAction` TEXT NULL,
    `notes` TEXT NULL,
    `leadSource` VARCHAR(100) NULL,
    `leadSourceOther` VARCHAR(100) NULL,
    `assignedTelecallerId` VARCHAR(36) NULL,
    `assignedSalesmanId` VARCHAR(36) NULL,
    `createdById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastActivityAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `convertedAt` DATETIME(3) NULL,
    `dealValue` DOUBLE NULL,
    `lostReason` VARCHAR(100) NULL,
    `lostNotes` TEXT NULL,
    `archivedAt` DATETIME(3) NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,
    `deletedById` VARCHAR(36) NULL,

    INDEX `Lead_pipelineStage_idx`(`pipelineStage`),
    INDEX `Lead_salesStage_idx`(`salesStage`),
    INDEX `Lead_leadSource_idx`(`leadSource`),
    INDEX `Lead_assignedTelecallerId_idx`(`assignedTelecallerId`),
    INDEX `Lead_assignedSalesmanId_idx`(`assignedSalesmanId`),
    INDEX `Lead_priority_idx`(`priority`),
    INDEX `Lead_phone_idx`(`phone`),
    INDEX `Lead_email_idx`(`email`),
    INDEX `Lead_companyName_idx`(`companyName`),
    INDEX `Lead_lastActivityAt_idx`(`lastActivityAt`),
    INDEX `Lead_nextFollowUpDate_idx`(`nextFollowUpDate`),
    INDEX `Lead_createdAt_idx`(`createdAt`),
    INDEX `Lead_updatedAt_idx`(`updatedAt`),
    INDEX `Lead_isDeleted_idx`(`isDeleted`),
    INDEX `Lead_isDeleted_pipelineStage_idx`(`isDeleted`, `pipelineStage`),
    INDEX `Lead_assignedTelecallerId_pipelineStage_idx`(`assignedTelecallerId`, `pipelineStage`),
    INDEX `Lead_assignedTelecallerId_nextFollowUpDate_idx`(`assignedTelecallerId`, `nextFollowUpDate`),
    INDEX `Lead_assignedSalesmanId_salesStage_idx`(`assignedSalesmanId`, `salesStage`),
    INDEX `Lead_pipelineStage_lastCallOutcome_idx`(`pipelineStage`, `lastCallOutcome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadActivity` (
    `id` VARCHAR(36) NOT NULL,
    `leadId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NULL,
    `type` VARCHAR(50) NOT NULL,
    `description` TEXT NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadActivity_leadId_createdAt_idx`(`leadId`, `createdAt`),
    INDEX `LeadActivity_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadAssignmentHistory` (
    `id` VARCHAR(36) NOT NULL,
    `leadId` VARCHAR(36) NOT NULL,
    `assignedById` VARCHAR(36) NOT NULL,
    `previousUserId` VARCHAR(36) NULL,
    `newUserId` VARCHAR(36) NOT NULL,
    `roleType` ENUM('TELECALLER', 'SALESMAN') NOT NULL,
    `handoverSummary` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadAssignmentHistory_leadId_createdAt_idx`(`leadId`, `createdAt`),
    INDEX `LeadAssignmentHistory_newUserId_idx`(`newUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CallLog` (
    `id` VARCHAR(36) NOT NULL,
    `leadId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `outcome` VARCHAR(50) NOT NULL,
    `notes` TEXT NOT NULL,
    `contactDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `followUpNeeded` BOOLEAN NOT NULL DEFAULT false,
    `nextFollowUpDate` DATETIME(3) NULL,
    `nextAction` TEXT NULL,
    `durationSeconds` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CallLog_leadId_contactDate_idx`(`leadId`, `contactDate`),
    INDEX `CallLog_userId_contactDate_idx`(`userId`, `contactDate`),
    INDEX `CallLog_contactDate_idx`(`contactDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FollowUpTask` (
    `id` VARCHAR(36) NOT NULL,
    `leadId` VARCHAR(36) NOT NULL,
    `assignedUserId` VARCHAR(36) NOT NULL,
    `taskType` ENUM('CALL', 'FOLLOW_UP', 'DEMO', 'MEETING', 'OTHER') NOT NULL DEFAULT 'FOLLOW_UP',
    `dueDate` DATETIME(3) NOT NULL,
    `dueTime` VARCHAR(20) NULL,
    `notes` TEXT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FollowUpTask_assignedUserId_dueDate_status_idx`(`assignedUserId`, `dueDate`, `status`),
    INDEX `FollowUpTask_leadId_idx`(`leadId`),
    INDEX `FollowUpTask_dueDate_idx`(`dueDate`),
    INDEX `FollowUpTask_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `message` TEXT NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `link` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_isRead_createdAt_idx`(`userId`, `isRead`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportJob` (
    `id` VARCHAR(36) NOT NULL,
    `createdById` VARCHAR(36) NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `totalRows` INTEGER NOT NULL DEFAULT 0,
    `validRows` INTEGER NOT NULL DEFAULT 0,
    `invalidRows` INTEGER NOT NULL DEFAULT 0,
    `duplicateRows` INTEGER NOT NULL DEFAULT 0,
    `importedRows` INTEGER NOT NULL DEFAULT 0,
    `skippedRows` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ImportJob_createdById_createdAt_idx`(`createdById`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportRow` (
    `id` VARCHAR(36) NOT NULL,
    `importJobId` VARCHAR(36) NOT NULL,
    `rawData` JSON NOT NULL,
    `parsedData` JSON NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    `duplicateReason` VARCHAR(255) NULL,
    `resolution` VARCHAR(50) NULL,
    `leadId` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ImportRow_importJobId_idx`(`importJobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NULL,
    `action` VARCHAR(50) NOT NULL,
    `entity` VARCHAR(50) NOT NULL,
    `entityId` VARCHAR(36) NULL,
    `details` JSON NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `AuditLog_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `AuditLog_action_createdAt_idx`(`action`, `createdAt`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PipelineStageOption` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `color` VARCHAR(50) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PipelineStageOption_name_key`(`name`),
    INDEX `PipelineStageOption_isActive_order_idx`(`isActive`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CallOutcomeOption` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `color` VARCHAR(50) NULL,
    `suggestedPipelineStage` VARCHAR(50) NULL,
    `requiresDateTime` BOOLEAN NOT NULL DEFAULT false,
    `requiresNextFollowUp` BOOLEAN NOT NULL DEFAULT false,
    `closesLead` BOOLEAN NOT NULL DEFAULT false,
    `autoReturnNewLeadsDays` INTEGER NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CallOutcomeOption_name_key`(`name`),
    INDEX `CallOutcomeOption_isActive_order_idx`(`isActive`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadSourceOption` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `color` VARCHAR(50) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LeadSourceOption_name_key`(`name`),
    INDEX `LeadSourceOption_isActive_order_idx`(`isActive`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_assignedTelecallerId_fkey` FOREIGN KEY (`assignedTelecallerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_assignedSalesmanId_fkey` FOREIGN KEY (`assignedSalesmanId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadActivity` ADD CONSTRAINT `LeadActivity_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadActivity` ADD CONSTRAINT `LeadActivity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadAssignmentHistory` ADD CONSTRAINT `LeadAssignmentHistory_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadAssignmentHistory` ADD CONSTRAINT `LeadAssignmentHistory_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadAssignmentHistory` ADD CONSTRAINT `LeadAssignmentHistory_previousUserId_fkey` FOREIGN KEY (`previousUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadAssignmentHistory` ADD CONSTRAINT `LeadAssignmentHistory_newUserId_fkey` FOREIGN KEY (`newUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallLog` ADD CONSTRAINT `CallLog_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallLog` ADD CONSTRAINT `CallLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUpTask` ADD CONSTRAINT `FollowUpTask_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUpTask` ADD CONSTRAINT `FollowUpTask_assignedUserId_fkey` FOREIGN KEY (`assignedUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportRow` ADD CONSTRAINT `ImportRow_importJobId_fkey` FOREIGN KEY (`importJobId`) REFERENCES `ImportJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportRow` ADD CONSTRAINT `ImportRow_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

