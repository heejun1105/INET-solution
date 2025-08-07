package com.inet;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

@SpringBootApplication
@EnableRetry
@EnableMethodSecurity(prePostEnabled = true)
public class INETApplication {

	public static void main(String[] args) {
		SpringApplication.run(INETApplication.class, args);
	}

}
