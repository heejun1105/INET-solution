package com.inet.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

import com.inet.service.CustomUserDetailsService;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, CustomUserDetailsService userDetailsService) throws Exception {
        http
            .userDetailsService(userDetailsService)
            .authorizeHttpRequests(authorize -> authorize
                // 공개 접근 가능한 페이지들
                .requestMatchers("/", "/login", "/signup", "/find-id", "/find-password", "/get-security-question", "/css/**", "/js/**", "/images/**", 
                               "/main.css", "/navbar.css", "/favicon.ico").permitAll()
                
                // 관리자만 접근 가능한 페이지들
                .requestMatchers("/admin/**", "/user/approve/**", "/user/reject/**", "/user/suspend/**").hasRole("ADMIN")
                
                // 인증된 사용자만 접근 가능한 페이지들 (메인 페이지 제외)
                .requestMatchers("/device/**", "/school/**", "/classroom/**", "/operator/**", 
                               "/wireless-ap/**", "/ip/**", "/data/**", "/floorplan/**", "/file-download/**",
                               "/mypage/**").authenticated()
                
                // 나머지 모든 요청은 인증 필요
                .anyRequest().authenticated()
            )
                                    .formLogin(form -> form
                            .loginPage("/login")
                            .successHandler(authenticationSuccessHandler())
                            .failureUrl("/login?error=true")
                            .failureHandler((request, response, exception) -> {
                                String errorMessage = "아이디 또는 비밀번호가 올바르지 않습니다.";
                                if (exception.getMessage().contains("승인 대기중")) {
                                    errorMessage = "해당 계정은 승인 대기중 입니다.";
                                }
                                request.getSession().setAttribute("errorMessage", errorMessage);
                                response.sendRedirect("/login");
                            })
                            .permitAll()
                        )
            .logout(logout -> logout
                .logoutRequestMatcher(new AntPathRequestMatcher("/logout"))
                .logoutSuccessUrl("/")
                .permitAll()
            )
            .exceptionHandling(exception -> exception
                .accessDeniedPage("/access-denied")
            )
            .csrf(csrf -> csrf.disable());
        
        return http.build();
    }
    
    @Bean
    public CustomAuthenticationSuccessHandler authenticationSuccessHandler() {
        return new CustomAuthenticationSuccessHandler();
    }
} 