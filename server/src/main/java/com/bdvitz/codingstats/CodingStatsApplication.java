package com.bdvitz.codingstats;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CodingStatsApplication {
    public static void main(String[] args) {
        SpringApplication.run(CodingStatsApplication.class, args);
    }
}
