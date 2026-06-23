-- ASI-Evolve experiment database tables
-- Ported from GAIR-NLP/ASI-Evolve: database/database.py, evolve_core/run_state.py
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `evolve_runs` (
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
  `managed_prompts` json DEFAULT NULL COMMENT 'Serialized ManagedPrompts from Manager agent (run_state.py)',
  `island_state` json DEFAULT NULL COMMENT 'Serialized IslandSampler rotation state for resumability',
  CONSTRAINT `evolve_runs_id` PRIMARY KEY(`id`),
  CONSTRAINT `evolve_runs_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `evolve_nodes` (
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
  CONSTRAINT `evolve_nodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `evolve_cognition` (
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

-- citation.manus.space verdict columns (added Phase 5)
ALTER TABLE evolve_nodes
  ADD COLUMN IF NOT EXISTS citation_verdict VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS citation_doc_id VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS citation_confidence DOUBLE NULL;
