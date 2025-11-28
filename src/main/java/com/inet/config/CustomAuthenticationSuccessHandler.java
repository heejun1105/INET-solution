package com.inet.config;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import com.inet.service.UserService;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class CustomAuthenticationSuccessHandler implements AuthenticationSuccessHandler {
    
    private static final Logger log = LoggerFactory.getLogger(CustomAuthenticationSuccessHandler.class);
    
    @Autowired
    private UserService userService;
    
    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, 
                                     HttpServletResponse response, 
                                     Authentication authentication) throws IOException, ServletException {
        
        // 로그인 성공 시 마지막 로그인 시간 업데이트
        String username = authentication.getName();
        try {
            userService.updateLastLoginTime(username);
        } catch (Exception e) {
            // 로그인 시간 업데이트 실패해도 로그인은 성공으로 처리
            log.warn("마지막 로그인 시간 업데이트 실패: {}", e.getMessage());
        }
        
        // 기본 성공 페이지로 리다이렉트
        response.sendRedirect("/");
    }
} 