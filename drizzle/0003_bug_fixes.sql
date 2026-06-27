-- Fix 1: Ghost cycles — mark stuck running cycles as failed
-- These specific cycle IDs were stuck in 'running' state
UPDATE `verification_cycles` SET `status` = 'failed', `completed_at` = NOW()
WHERE `cycle_id` IN ('8b602f95', '6ae3b56d') AND `status` = 'running';
--> statement-breakpoint

-- Fix 7: approval_requests table with auto_approved column
CREATE TABLE IF NOT EXISTS `approval_requests` (
  `id` int AUTO_INCREMENT NOT NULL,
  `request_id` varchar(36) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `auto_approved` boolean DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `approval_requests_id` PRIMARY KEY(`id`),
  CONSTRAINT `approval_requests_request_id_unique` UNIQUE(`request_id`)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_approval_requests_auto_approved`
ON `approval_requests`(`auto_approved`);
