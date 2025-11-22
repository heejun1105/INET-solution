package com.inet.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import com.inet.entity.User;
import com.inet.entity.UserRole;
import com.inet.entity.Permission;
import com.inet.service.UserService;
import com.inet.service.PermissionService;

import com.inet.config.PermissionHelper;

@Controller
@RequestMapping("/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private PermissionService permissionService;
    
    @Autowired
    private PermissionHelper permissionHelper;
    

    
    // 관리자 대시보드
    @GetMapping("/dashboard")
    public String dashboard(@RequestParam(value = "page", defaultValue = "0") int page, Model model) {
        Pageable pageable = PageRequest.of(page, 10);
        Page<User> pendingUsersPage = userService.getPendingUsers(pageable);
        
        model.addAttribute("pendingUsers", pendingUsersPage.getContent());
        model.addAttribute("pendingCount", pendingUsersPage.getTotalElements());
        model.addAttribute("pendingUsersPage", pendingUsersPage);
        model.addAttribute("currentPage", page);
        
        // 권한 정보 추가 (네비게이션 바용)
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User user = null;
        if (auth != null && auth.isAuthenticated()) {
            user = userService.findByUsername(auth.getName()).orElse(null);
        }
        permissionHelper.addPermissionAttributes(user, model);
        
        return "admin/dashboard";
    }
    
    // 사용자 관리 페이지
    @GetMapping("/users")
    public String userManagement(@RequestParam(value = "keyword", required = false) String keyword,
                                 @RequestParam(value = "page", defaultValue = "0") int page,
                                 Model model) {
        Pageable pageable = PageRequest.of(page, 10);
        Page<User> usersPage;
        
        if (keyword != null && !keyword.trim().isEmpty()) {
            usersPage = userService.searchUsers(keyword, pageable);
        } else {
            usersPage = userService.getAllUsers(pageable);
        }
        
        model.addAttribute("users", usersPage.getContent());
        model.addAttribute("usersPage", usersPage);
        model.addAttribute("keyword", keyword);
        model.addAttribute("currentPage", page);
        model.addAttribute("roles", UserRole.values());
        
        // 권한 정보 추가 (네비게이션 바용)
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User user = null;
        if (auth != null && auth.isAuthenticated()) {
            user = userService.findByUsername(auth.getName()).orElse(null);
        }
        permissionHelper.addPermissionAttributes(user, model);
        
        return "admin/users";
    }
    
    // 사용자 승인
    @PostMapping("/users/approve")
    public String approveUser(@RequestParam Long userId, 
                            @RequestParam String approvedBy,
                            @RequestParam String role,
                            RedirectAttributes redirectAttributes) {
        try {
            userService.approveUser(userId, approvedBy, role);
            redirectAttributes.addFlashAttribute("successMessage", "사용자가 승인되었습니다.");
        } catch (RuntimeException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
        }
        
        return "redirect:/admin/dashboard";
    }
    
    // 사용자 거부
    @PostMapping("/users/reject")
    public String rejectUser(@RequestParam Long userId,
                           @RequestParam String rejectedBy,
                           RedirectAttributes redirectAttributes) {
        try {
            userService.rejectUser(userId, rejectedBy);
            redirectAttributes.addFlashAttribute("successMessage", "사용자가 거부되었습니다.");
        } catch (RuntimeException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
        }
        
        return "redirect:/admin/dashboard";
    }
    
    // 사용자 정지
    @PostMapping("/users/suspend")
    public String suspendUser(@RequestParam Long userId,
                            @RequestParam String suspendedBy,
                            RedirectAttributes redirectAttributes) {
        try {
            userService.suspendUser(userId, suspendedBy);
            redirectAttributes.addFlashAttribute("successMessage", "사용자가 정지되었습니다.");
        } catch (RuntimeException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
        }
        
        return "redirect:/admin/users";
    }
    
    // 사용자 탈퇴
    @PostMapping("/users/delete")
    public String deleteUser(@RequestParam Long userId,
                           @RequestParam String deletedBy,
                           RedirectAttributes redirectAttributes) {
        try {
            userService.deleteUser(userId, deletedBy);
            redirectAttributes.addFlashAttribute("successMessage", "사용자가 탈퇴되었습니다.");
        } catch (RuntimeException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
        }
        
        return "redirect:/admin/users";
    }
    
    // 사용자 역할 변경
    @PostMapping("/users/change-role")
    public String changeUserRole(@RequestParam Long userId,
                               @RequestParam UserRole newRole,
                               RedirectAttributes redirectAttributes) {
        try {
            userService.changeUserRole(userId, newRole);
            redirectAttributes.addFlashAttribute("successMessage", "사용자 역할이 변경되었습니다.");
        } catch (RuntimeException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
        }
        
        return "redirect:/admin/users";
    }
    
    // 사용자 권한 관리 페이지로 리다이렉트
    @GetMapping("/users/permissions")
    public String getUserPermissions(@RequestParam Long userId, Model model) {
        return "redirect:/admin/permissions/manage?userId=" + userId;
    }
    
    // 사용자 권한 조회 (JSON API) - 새로운 권한 시스템 사용
    @GetMapping("/users/get-permissions")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getUserPermissionsJson(@RequestParam Long userId) {
        try {
            User user = userService.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
            
            List<Permission> permissions = permissionService.getUserPermissions(user);
            Map<String, Object> response = new HashMap<>();
            response.put("permissions", permissions);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // 사용자 권한 업데이트 - 새로운 권한 시스템 사용
    @PostMapping("/users/update-permissions")
    @ResponseBody
    public ResponseEntity<String> updateUserPermissions(@RequestParam Long userId,
                                                      @RequestParam String permissions) {
        try {
            // 새로운 권한 시스템에서는 PermissionController에서 처리
            return ResponseEntity.ok("success");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
    

} 