package com.metaagent.platform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableAsync
@EnableScheduling
@SpringBootApplication
public class PlatformApplication {

    public static void main(String[] args) {
        if (System.getenv("NODE_ID") == null) {
            throw new IllegalStateException(
                    "NODE_ID environment variable must be set before starting the platform. " +
                    "Assign a unique integer 0–1023 per application node.");
        }
        SpringApplication.run(PlatformApplication.class, args);
    }
}
