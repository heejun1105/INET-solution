package com.inet.controller;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import com.inet.entity.User;
import com.inet.entity.SecurityQuestion;
import com.inet.service.UserService;
import com.inet.config.PermissionHelper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Controller
public class AuthController {
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private PermissionHelper permissionHelper;
    
    // 로그인 페이지
    @GetMapping("/login")
    public String loginPage(@RequestParam(value = "error", required = false) String error, 
                           Model model, 
                           HttpServletRequest request) {
        // 세션에서 에러 메시지 확인
        String sessionError = (String) request.getSession().getAttribute("errorMessage");
        if (sessionError != null) {
            model.addAttribute("errorMessage", sessionError);
            request.getSession().removeAttribute("errorMessage");
        } else if (error != null) {
            model.addAttribute("errorMessage", "아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        
        // 권한 정보 추가 (네비게이션 바용)
        permissionHelper.addPermissionAttributes(null, model);
        
        return "auth/login";
    }
    
    // 회원가입 페이지
    @GetMapping("/signup")
    public String signupPage(Model model) {
        // 권한 정보 추가 (네비게이션 바용)
        permissionHelper.addPermissionAttributes(null, model);
        return "auth/signup";
    }
    
    // 회원가입 처리
    @PostMapping("/signup")
    public String signup(@RequestParam String username,
                        @RequestParam String password,
                        @RequestParam String confirmPassword,
                        @RequestParam String name,
                        @RequestParam(required = false) String birthDate,
                        @RequestParam(required = false) String birthYear,
                        @RequestParam(required = false) String birthMonth,
                        @RequestParam(required = false) String birthDay,
                        @RequestParam String organization,
                        @RequestParam String position,
                        @RequestParam String phoneNumber,
                        @RequestParam String email,
                        @RequestParam String securityQuestion,
                        @RequestParam String securityAnswer,
                        RedirectAttributes redirectAttributes) {
        
        // 생년월일 처리
        String finalBirthDate = birthDate;
        if (birthDate == null || birthDate.isEmpty()) {
            if (birthYear != null && birthMonth != null && birthDay != null) {
                finalBirthDate = birthYear + "-" + birthMonth + "-" + birthDay;
            } else {
                redirectAttributes.addFlashAttribute("errorMessage", "생년월일을 입력해주세요.");
                return "redirect:/signup";
            }
        }
        
        try {
            // 비밀번호 확인
            if (!password.equals(confirmPassword)) {
                redirectAttributes.addFlashAttribute("errorMessage", "비밀번호가 일치하지 않습니다.");
                return "redirect:/signup";
            }
            
            // 회원가입 처리 (역할은 관리자가 승인할 때 지정)
            User user = userService.registerUser(username, password, name, finalBirthDate, organization, position, phoneNumber, email, securityQuestion, securityAnswer);
            
            redirectAttributes.addFlashAttribute("successMessage", 
                "회원가입이 완료되었습니다. 관리자 승인 후 로그인이 가능합니다.");
            
            return "redirect:/login";
            
        } catch (RuntimeException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
            return "redirect:/signup";
        }
    }
    
    // 로그아웃
    @GetMapping("/logout")
    public String logout(HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) {
            new SecurityContextLogoutHandler().logout(request, response, auth);
        }
        return "redirect:/";
    }
    
    // 아이디 찾기 페이지
    @GetMapping("/find-id")
    public String findIdPage(Model model) {
        model.addAttribute("securityQuestions", SecurityQuestion.values());
        // 권한 정보 추가 (네비게이션 바용)
        permissionHelper.addPermissionAttributes(null, model);
        return "auth/find-id";
    }
    
    // 아이디 찾기 처리
    @PostMapping("/find-id")
    public String findId(@RequestParam String name,
                        @RequestParam(required = false) String birthDate,
                        @RequestParam(required = false) String birthYear,
                        @RequestParam(required = false) String birthMonth,
                        @RequestParam(required = false) String birthDay,
                        @RequestParam String email,
                        Model model) {
        
        // 생년월일 처리
        String finalBirthDate = birthDate;
        if (birthDate == null || birthDate.isEmpty()) {
            if (birthYear != null && birthMonth != null && birthDay != null) {
                finalBirthDate = birthYear + "-" + birthMonth + "-" + birthDay;
            } else {
                model.addAttribute("errorMessage", "생년월일을 입력해주세요.");
                return "auth/find-result";
            }
        }
        try {
            List<String> usernames = userService.findUsernames(name, finalBirthDate, email);
            if (!usernames.isEmpty()) {
                model.addAttribute("usernames", usernames);
                model.addAttribute("successMessage", "일치하는 아이디를 찾았습니다.");
            } else {
                model.addAttribute("errorMessage", "일치하는 정보를 찾을 수 없습니다.");
            }
        } catch (Exception e) {
            model.addAttribute("errorMessage", "아이디 찾기 중 오류가 발생했습니다: " + e.getMessage());
        }
        return "auth/find-result";
    }
    
    // 비밀번호 찾기 페이지
    @GetMapping("/find-password")
    public String findPasswordPage(Model model) {
        model.addAttribute("securityQuestions", SecurityQuestion.values());
        // 권한 정보 추가 (네비게이션 바용)
        permissionHelper.addPermissionAttributes(null, model);
        return "auth/find-password";
    }
    
    // 사용자 보안질문 조회 (AJAX용)
    @PostMapping("/get-security-question")
    public String getSecurityQuestion(@RequestParam String username, Model model) {
        try {
            Optional<User> userOpt = userService.findByUsername(username);
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                model.addAttribute("securityQuestion", user.getSecurityQuestion());
                model.addAttribute("success", true);
            } else {
                model.addAttribute("success", false);
                model.addAttribute("message", "사용자를 찾을 수 없습니다.");
            }
        } catch (Exception e) {
            model.addAttribute("success", false);
            model.addAttribute("message", "오류가 발생했습니다.");
        }
        return "auth/security-question-fragment";
    }
    
    // 비밀번호 찾기 처리
    @PostMapping("/find-password")
    public String findPassword(@RequestParam String username,
                             @RequestParam String name,
                             @RequestParam(required = false) String birthDate,
                             @RequestParam(required = false) String birthYear,
                             @RequestParam(required = false) String birthMonth,
                             @RequestParam(required = false) String birthDay,
                             @RequestParam String securityQuestion,
                             @RequestParam String securityAnswer,
                             Model model) {
        
        // 생년월일 처리
        String finalBirthDate = birthDate;
        if (birthDate == null || birthDate.isEmpty()) {
            if (birthYear != null && birthMonth != null && birthDay != null) {
                finalBirthDate = birthYear + "-" + birthMonth + "-" + birthDay;
            } else {
                model.addAttribute("errorMessage", "생년월일을 입력해주세요.");
                return "auth/find-result";
            }
        }
        try {
            // 사용자 정보 확인
            User user = userService.findUserForPasswordReset(username, name, finalBirthDate);
            
            // 보안 질문과 답변 확인
            if (userService.verifySecurityQuestionAndAnswer(username, securityQuestion, securityAnswer)) {
                // 임시 비밀번호 생성
                String temporaryPassword = userService.generateTemporaryPassword();
                
                // 임시 비밀번호로 비밀번호 변경
                userService.resetPasswordWithTemporary(username, temporaryPassword);
                
                model.addAttribute("username", username);
                model.addAttribute("temporaryPassword", temporaryPassword);
                model.addAttribute("successMessage", "임시 비밀번호가 생성되었습니다.");
            } else {
                model.addAttribute("errorMessage", "보안 질문 또는 답변이 일치하지 않습니다.");
            }
        } catch (Exception e) {
            model.addAttribute("errorMessage", "비밀번호 찾기 중 오류가 발생했습니다: " + e.getMessage());
        }
        return "auth/find-result";
    }
    
    // 접근 거부 페이지
    @GetMapping("/access-denied")
    public String accessDenied(Model model) {
        // 권한 정보 추가 (네비게이션 바용)
        permissionHelper.addPermissionAttributes(null, model);
        return "auth/access-denied";
    }
} 