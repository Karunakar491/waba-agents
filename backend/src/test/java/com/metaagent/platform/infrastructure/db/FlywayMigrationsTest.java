package com.metaagent.platform.infrastructure.db;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Applies every migration to an empty MySQL and asserts it lands clean.
 *
 * This exists because it was missing. On 2026-09-04 V56 declared a foreign key
 * as {@code BIGINT} against {@code connector.id}, which is {@code BIGINT
 * UNSIGNED}. MySQL refuses a foreign key whose column type differs from its
 * target's even by signedness, so the CREATE TABLE was rejected — but MySQL DDL
 * is not transactional, so Flyway recorded the version as failed and every
 * subsequent boot aborted on "Detected failed migration to version 56". The
 * backend crash-looped and production returned 502 for about four minutes.
 *
 * Nothing in the build would have caught it: unit tests mock the repositories,
 * and {@code mvn package} never touches a database. The same failure had already
 * happened once before, on V50 (2026-08-13, also a lost UNSIGNED) — so this is a
 * repeat, which is what makes it worth a container.
 *
 * Requires Docker. Skipped rather than failed where Docker is unavailable, so a
 * machine without it does not report a false red — but CI must have it, or this
 * guard is decorative.
 */
@Testcontainers
class FlywayMigrationsTest {

    @Container
    @SuppressWarnings("resource") // Testcontainers closes it via the @Container lifecycle
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0.46")
            .withDatabaseName("meta_agent_db")
            .withUsername("meta_agent")
            .withPassword("test_only_not_a_real_secret");

    @Test
    @DisplayName("every migration applies to an empty database, in order, with no failures")
    void allMigrationsApplyCleanly() throws Exception {
        Flyway flyway = Flyway.configure()
                .dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
                .locations("classpath:db/migration")
                .load();

        MigrateResult result = flyway.migrate();

        assertThat(result.success).as("Flyway reported failure").isTrue();
        assertThat(result.migrationsExecuted).as("no migrations ran — wrong location?").isGreaterThan(50);

        // A failed migration leaves success = 0 behind and poisons every later
        // boot. That is the exact state that took production down, so assert on
        // the history table rather than trusting the summary.
        try (Connection conn = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
             Statement st = conn.createStatement()) {

            try (ResultSet rs = st.executeQuery(
                    "SELECT COUNT(*) FROM flyway_schema_history WHERE success = 0")) {
                rs.next();
                assertThat(rs.getInt(1)).as("a migration is recorded as failed").isZero();
            }

            // And validate() is what the app itself runs on boot.
            flyway.validate();
        }
    }

    @Test
    @DisplayName("connector_action's foreign key matches connector.id exactly, signedness included")
    void connectorActionForeignKeyTypeMatches() throws Exception {
        Flyway.configure()
                .dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
                .locations("classpath:db/migration")
                .load()
                .migrate();

        try (Connection conn = DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
             Statement st = conn.createStatement()) {

            // If the FK had not been created, the constraint would simply be absent
            // — which is how the original bug would show up here.
            try (ResultSet rs = st.executeQuery(
                    "SELECT COUNT(*) FROM information_schema.referential_constraints "
                            + "WHERE constraint_schema = DATABASE() "
                            + "AND constraint_name = 'fk_connector_action_connector'")) {
                rs.next();
                assertThat(rs.getInt(1)).as("the foreign key to connector was not created").isEqualTo(1);
            }

            try (ResultSet rs = st.executeQuery(
                    "SELECT c1.column_type, c2.column_type FROM information_schema.columns c1 "
                            + "JOIN information_schema.columns c2 ON c2.table_schema = DATABASE() "
                            + "AND c2.table_name = 'connector' AND c2.column_name = 'id' "
                            + "WHERE c1.table_schema = DATABASE() AND c1.table_name = 'connector_action' "
                            + "AND c1.column_name = 'connector_id'")) {
                rs.next();
                assertThat(rs.getString(1))
                        .as("connector_action.connector_id must match connector.id exactly")
                        .isEqualTo(rs.getString(2));
            }
        }
    }
}
