CREATE TABLE `evolve_cognition` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`content` text NOT NULL,
	`source` varchar(128),
	`embedding` json,
	`score` double NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL,
	`metadata` json,
	CONSTRAINT `evolve_cognition_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evolve_nodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`run_id` int NOT NULL,
	`step_name` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`motivation` text,
	`code` text,
	`results` json,
	`analysis` text,
	`score` double NOT NULL DEFAULT 0,
	`eval_score` double NOT NULL DEFAULT 0,
	`success` boolean NOT NULL DEFAULT false,
	`parent_ids` json,
	`visit_count` int NOT NULL DEFAULT 0,
	`is_best` boolean NOT NULL DEFAULT false,
	`created_at` bigint NOT NULL,
	`metadata` json,
	`citation_verdict` varchar(50),
	`citation_doc_id` varchar(100),
	`citation_confidence` double,
	CONSTRAINT `evolve_nodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evolve_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`objective` text NOT NULL,
	`sampling_algorithm` varchar(50) NOT NULL DEFAULT 'ucb1',
	`ucb1_c` double NOT NULL DEFAULT 1.414,
	`eval_score_target` double NOT NULL DEFAULT 9.5,
	`max_steps` int NOT NULL DEFAULT 100,
	`step_count` int NOT NULL DEFAULT 0,
	`best_score` double NOT NULL DEFAULT 0,
	`best_node_id` int,
	`status` enum('running','paused','completed','failed') NOT NULL DEFAULT 'running',
	`started_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	`metadata` json NOT NULL,
	`managed_prompts` json,
	`island_state` json,
	CONSTRAINT `evolve_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `evolve_runs_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `verification_cycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cycle_id` varchar(36) NOT NULL,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`phases` json,
	`candidates_discovered` int NOT NULL DEFAULT 0,
	`candidates_scored` int NOT NULL DEFAULT 0,
	`claims_verified` int NOT NULL DEFAULT 0,
	`cognition_items_added` int NOT NULL DEFAULT 0,
	`evolve_step_name` varchar(64),
	`evolve_score` float,
	`convergence_reached` boolean NOT NULL DEFAULT false,
	`best_pic50` float,
	`error_message` text,
	`duration_ms` int,
	CONSTRAINT `verification_cycles_id` PRIMARY KEY(`id`),
	CONSTRAINT `verification_cycles_cycle_id_unique` UNIQUE(`cycle_id`)
);
