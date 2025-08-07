package com.inet.controller;

import com.inet.entity.*;
import com.inet.service.*;
import com.inet.config.PermissionHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@Controller
@RequestMapping("/admin/permissions")
public class PermissionController {
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private PermissionService permissionService;
    
    @Autowired
    private SchoolPermissionService schoolPermissionService;
    
    @Autowired
    private PermissionHelper permissionHelper;
    
    // 권한 관리 페이지
    @GetMapping("/manage")
    public String managePermissions(@RequestParam Long userId, Model model) {
        Optional<User> userOpt = userService.findById(userId);
        if (userOpt.isEmpty()) {
            return "redirect:/admin/users";
        }
        
        User user = userOpt.get();
        List<Permission> userPermissions = permissionService.getUserPermissions(user);
        List<SchoolPermission> userSchoolPermissions = schoolPermissionService.getUserSchoolPermissions(user);
        List<School> allSchools = schoolPermissionService.getAllSchools();
        
        // 사용자의 권한을 문자열 리스트로 변환 (체크박스용)
        Set<String> userPermissionStrings = userPermissions.stream()
                .map(p -> p.getFeature().name())
                .collect(Collectors.toSet());
        
        // 사용자의 학교 권한을 ID 리스트로 변환 (체크박스용)
        Set<Long> userSchoolPermissionIds = userSchoolPermissions.stream()
                .map(sp -> sp.getSchool().getSchoolId())
                .collect(Collectors.toSet());
        
        model.addAttribute("user", user);
        model.addAttribute("features", Feature.values());
        model.addAttribute("userPermissions", userPermissionStrings);
        model.addAttribute("userSchoolPermissions", userSchoolPermissionIds);
        model.addAttribute("allSchools", allSchools);
        
        // 권한 정보 추가 (네비게이션 바용)
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User currentUser = null;
        if (auth != null && auth.isAuthenticated()) {
            currentUser = userService.findByUsername(auth.getName()).orElse(null);
        }
        permissionHelper.addPermissionAttributes(currentUser, model);
        
        return "admin/permissions";
    }
    
    // 권한 저장 (기능권한 + 학교권한)
    @PostMapping("/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> savePermissions(@RequestBody Map<String, Object> request) {
        try {
            System.out.println("권한 저장 요청 받음: " + request);
            
            // userId 추출 및 검증
            Object userIdObj = request.get("userId");
            if (userIdObj == null) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "사용자 ID가 제공되지 않았습니다.");
                return ResponseEntity.badRequest().body(response);
            }
            
            Long userId = Long.valueOf(userIdObj.toString());
            System.out.println("사용자 ID: " + userId);
            
            // 기능 권한 추출 및 검증
            Object featurePermissionsObj = request.get("featurePermissions");
            List<String> featurePermissions = new ArrayList<>();
            if (featurePermissionsObj instanceof List) {
                featurePermissions = (List<String>) featurePermissionsObj;
            }
            System.out.println("기능 권한: " + featurePermissions);
            
            // 학교 권한 추출 및 검증
            Object schoolPermissionsObj = request.get("schoolPermissions");
            List<String> schoolPermissions = new ArrayList<>();
            if (schoolPermissionsObj instanceof List) {
                schoolPermissions = (List<String>) schoolPermissionsObj;
            }
            System.out.println("학교 권한: " + schoolPermissions);
            
            // 사용자 존재 확인
            Optional<User> userOpt = userService.findById(userId);
            if (userOpt.isEmpty()) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "사용자를 찾을 수 없습니다. ID: " + userId);
                return ResponseEntity.badRequest().body(response);
            }
            
            User user = userOpt.get();
            System.out.println("사용자 찾음: " + user.getUsername());
            
            // 기존 권한 모두 삭제
            permissionService.revokeAllPermissions(user);
            schoolPermissionService.revokeAllSchoolPermissions(user);
            System.out.println("기존 권한 삭제 완료");
            
            // 기능 권한 부여
            for (String featureName : featurePermissions) {
                try {
                    Feature feature = Feature.valueOf(featureName);
                    permissionService.grantPermission(user, feature);
                    System.out.println("기능 권한 부여: " + featureName);
                } catch (IllegalArgumentException e) {
                    System.out.println("잘못된 기능 이름: " + featureName);
                    Map<String, Object> response = new HashMap<>();
                    response.put("success", false);
                    response.put("message", "잘못된 기능 이름입니다: " + featureName);
                    return ResponseEntity.badRequest().body(response);
                }
            }
            
            // 학교 권한 부여
            List<Long> schoolIds = new ArrayList<>();
            for (String schoolIdStr : schoolPermissions) {
                try {
                    Long schoolId = Long.valueOf(schoolIdStr);
                    schoolIds.add(schoolId);
                } catch (NumberFormatException e) {
                    System.out.println("잘못된 학교 ID: " + schoolIdStr);
                    Map<String, Object> response = new HashMap<>();
                    response.put("success", false);
                    response.put("message", "잘못된 학교 ID입니다: " + schoolIdStr);
                    return ResponseEntity.badRequest().body(response);
                }
            }
            
            if (!schoolIds.isEmpty()) {
                schoolPermissionService.grantSchoolPermissions(user, schoolIds);
                System.out.println("학교 권한 부여 완료: " + schoolIds);
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "권한이 성공적으로 저장되었습니다.");
            System.out.println("권한 저장 완료");
            return ResponseEntity.ok(response);
            
        } catch (NumberFormatException e) {
            System.out.println("숫자 변환 오류: " + e.getMessage());
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "잘못된 숫자 형식입니다: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            System.out.println("권한 저장 중 오류: " + e.getMessage());
            e.printStackTrace();
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "권한 저장 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // 사용자 권한 조회 (JSON API)
    @GetMapping("/user-permissions")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getUserPermissions(@RequestParam Long userId) {
        try {
            Optional<User> userOpt = userService.findById(userId);
            if (userOpt.isEmpty()) {
                Map<String, Object> response = new HashMap<>();
                response.put("error", "사용자를 찾을 수 없습니다.");
                return ResponseEntity.badRequest().body(response);
            }
            
            User user = userOpt.get();
            List<Permission> permissions = permissionService.getUserPermissions(user);
            List<SchoolPermission> schoolPermissions = schoolPermissionService.getUserSchoolPermissions(user);
            
            Map<String, Object> response = new HashMap<>();
            response.put("permissions", permissions);
            response.put("schoolPermissions", schoolPermissions);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // 사용자가 접근 가능한 학교 목록 조회
    @GetMapping("/accessible-schools")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getAccessibleSchools(@RequestParam Long userId) {
        try {
            Optional<User> userOpt = userService.findById(userId);
            if (userOpt.isEmpty()) {
                Map<String, Object> response = new HashMap<>();
                response.put("error", "사용자를 찾을 수 없습니다.");
                return ResponseEntity.badRequest().body(response);
            }
            
            User user = userOpt.get();
            List<School> accessibleSchools = schoolPermissionService.getAccessibleSchools(user);
            
            Map<String, Object> response = new HashMap<>();
            response.put("schools", accessibleSchools);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
} 