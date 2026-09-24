CREATE TABLE `auth_sessions` (
	`user_id` text PRIMARY KEY,
	`session_id` text NOT NULL UNIQUE,
	`refresh_token_hash` text NOT NULL UNIQUE,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_auth_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL UNIQUE,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
