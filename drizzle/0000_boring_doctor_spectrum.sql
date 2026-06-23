CREATE TABLE `candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cycleId` int NOT NULL,
	`smiles` text NOT NULL,
	`parentSmiles` text,
	`track` enum('A','B','C','D') NOT NULL,
	`modificationType` varchar(64),
	`pic50Predicted` float,
	`confidenceScore` float DEFAULT 0,
	`pic50Vqe` float,
	`quantumHardware` varchar(64),
	`quantumScore` float,
	`provenanceStatus` varchar(32),
	`citationVerdict` varchar(64),
	`citationConfidence` float,
	`citationGatePassed` boolean DEFAULT false,
	`pubmedIds` json DEFAULT ('[]'),
	`citationIds` json DEFAULT ('[]'),
	`mw` float,
	`logp` float,
	`hbd` int,
	`hba` int,
	`tpsa` float,
	`lipinskiViolations` int,
	`isDruglike` boolean DEFAULT false,
	`isNovel` boolean DEFAULT true,
	`tanimotoToApproved` float,
	`isBestSoFar` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `citationRegistry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidateId` int NOT NULL,
	`citationUrl` text NOT NULL,
	`claimText` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `citationRegistry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cognitionStore` (
	`id` int AUTO_INCREMENT NOT NULL,
	`targetChemblId` varchar(32) NOT NULL,
	`targetName` varchar(128) NOT NULL,
	`bestAffinityEver` float,
	`bestSmilsEver` text,
	`bestPic50Ever` float,
	`cycleCount` int NOT NULL DEFAULT 0,
	`dayNumber` int NOT NULL DEFAULT 1,
	`accumulatedLessons` json DEFAULT ('[]'),
	`statisticalPatterns` json DEFAULT ('{}'),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cognitionStore_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `corpus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`refId` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`smiles` text NOT NULL,
	`source` varchar(64) NOT NULL,
	`pIC50` float NOT NULL,
	`confidence` float NOT NULL,
	`scaffold` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `corpus_id` PRIMARY KEY(`id`),
	CONSTRAINT `corpus_refId_unique` UNIQUE(`refId`)
);
--> statement-breakpoint
CREATE TABLE `cycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cycleNumber` int NOT NULL,
	`dayNumber` int NOT NULL DEFAULT 1,
	`corpusSize` int NOT NULL DEFAULT 0,
	`candidatesGenerated` int NOT NULL DEFAULT 0,
	`candidatesVerified` int NOT NULL DEFAULT 0,
	`bestPic50` float NOT NULL DEFAULT 0,
	`convergenceCandidates` int NOT NULL DEFAULT 0,
	`citationPassRate` varchar(32) DEFAULT '0/0',
	`convergenceReport` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cycles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dailyLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dayNumber` int NOT NULL,
	`cycleCount` int NOT NULL DEFAULT 0,
	`summary` text,
	`runData` json,
	`convergenceReport` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dailyLogs_id` PRIMARY KEY(`id`),
	CONSTRAINT `dailyLogs_dayNumber_unique` UNIQUE(`dayNumber`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
