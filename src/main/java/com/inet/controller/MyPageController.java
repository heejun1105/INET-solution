package com.inet.controller;

import com.inet.entity.User;
import com.inet.entity.Permission;
import com.inet.entity.SchoolPermission;
import com.inet.service.UserService;
import com.inet.service.PermissionService;
import com.inet.service.SchoolPermissionService;
import com.inet.config.PermissionHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import java.util.List;
import java.util.Optional;

@Controller
@RequestMapping("/mypage")
public class MyPageController {

    @Autowired
    private UserService userService;
    
    @Autowired
    private PermissionService permissionService;
    
    @Autowired
    private SchoolPermissionService schoolPermissionService;
    
    @Autowired
    private PermissionHelper permissionHelper;

    // 마이페이지 메인
    @GetMapping("")
    public String myPage(Model model) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        
        Optional<User> userOpt = userService.findByUsername(username);
        if (userOpt.isEmpty()) {
            return "redirect:/login";
        }
        
        User user = userOpt.get();
        List<Permission> userPermissions = permissionService.getUserPermissions(user);
        List<SchoolPermission> userSchoolPermissions = schoolPermissionService.getUserSchoolPermissions(user);
        model.addAttribute("user", user);
        model.addAttribute("userPermissions", userPermissions);
        model.addAttribute("userSchoolPermissions", userSchoolPermissions);
        
        // 권한 정보 추가 (네비게이션 바용)
        permissionHelper.addPermissionAttributes(user, model);
        
        return "mypage/index";
    }

    // 정보수정 페이지
    @GetMapping("/edit")
    public String editPage(Model model) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        
        Optional<User> userOpt = userService.findByUsername(username);
        if (userOpt.isEmpty()) {
            return "redirect:/login";
        }
        
        User user = userOpt.get();
        model.addAttribute("user", user);
        
        // 권한 정보 추가 (네비게이션 바용)
        permissionHelper.addPermissionAttributes(user, model);
        
        return "mypage/edit";
    }

    // 정보수정 처리
    @PostMapping("/edit")
    public String editUser(@ModelAttribute User userForm, 
                          @RequestParam(required = false) String newPassword,
                          @RequestParam(required = false) String confirmPassword,
                          RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        
        Optional<User> userOpt = userService.findByUsername(username);
        if (userOpt.isEmpty()) {
            return "redirect:/login";
        }
        
        User currentUser = userOpt.get();

        try {
            // 기본 정보 업데이트
            userService.updateUserInfo(currentUser.getId(), 
                                     userForm.getName(),
                                     userForm.getBirthDate(), 
                                     userForm.getOrganization(), 
                                     userForm.getPosition(), 
                                     userForm.getPhoneNumber(),
                                     userForm.getEmail());

            // 비밀번호 변경 처리
            if (newPassword != null && !newPassword.trim().isEmpty()) {
                if (!newPassword.equals(confirmPassword)) {
                    redirectAttributes.addFlashAttribute("error", "새 비밀번호가 일치하지 않습니다.");
                    return "redirect:/mypage/edit";
                }
                
                // 비밀번호 유효성 검사 (7자 이상, 특수문자 포함)
                if (newPassword.length() < 7 || !newPassword.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?].*")) {
                    redirectAttributes.addFlashAttribute("error", "비밀번호는 7자 이상이어야 하며 특수문자를 포함해야 합니다.");
                    return "redirect:/mypage/edit";
                }
                
                // 현재 비밀번호 확인 없이 비밀번호 변경
                userService.updatePassword(currentUser.getId(), newPassword);
            }

            redirectAttributes.addFlashAttribute("success", "정보가 성공적으로 수정되었습니다.");
            
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", "정보 수정 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return "redirect:/mypage";
    }

    // 계정 탈퇴 페이지
    @GetMapping("/withdraw")
    public String withdrawPage(Model model) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        
        Optional<User> userOpt = userService.findByUsername(username);
        if (userOpt.isEmpty()) {
            return "redirect:/login";
        }
        
        User user = userOpt.get();
        model.addAttribute("user", user);
        
        // 권한 정보 추가 (네비게이션 바용)
        permissionHelper.addPermissionAttributes(user, model);
        
        return "mypage/withdraw";
    }

    // 계정 탈퇴 처리
    @PostMapping("/withdraw")
    public String withdrawUser(@RequestParam String confirmPassword, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        
        Optional<User> userOpt = userService.findByUsername(username);
        if (userOpt.isEmpty()) {
            return "redirect:/login";
        }
        
        try {
            userService.deleteUser(userOpt.get().getId(), username);
            redirectAttributes.addFlashAttribute("success", "계정이 성공적으로 탈퇴되었습니다.");
            return "redirect:/logout";
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", "계정 탈퇴 중 오류가 발생했습니다.");
            return "redirect:/mypage/withdraw";
        }
    }
} 