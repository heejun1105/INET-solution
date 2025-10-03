package com.inet.controller;

import com.inet.entity.School;
import com.inet.service.SchoolService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List;
import com.inet.entity.Feature;
import com.inet.entity.User;
import com.inet.service.PermissionService;
import com.inet.service.SchoolPermissionService;
import com.inet.service.UserService;
import com.inet.config.PermissionHelper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.ResponseEntity;

@Controller
@RequestMapping("/school")
@RequiredArgsConstructor
@Slf4j
public class SchoolController {

    private final SchoolService schoolService;
    private final PermissionService permissionService;
    private final SchoolPermissionService schoolPermissionService;
    private final UserService userService;
    private final PermissionHelper permissionHelper;

    // 권한 체크 메서드
    private User checkPermission(Feature feature, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            redirectAttributes.addFlashAttribute("error", "로그인이 필요합니다.");
            return null;
        }
        
        User user = userService.findByUsername(auth.getName())
            .orElse(null);
        if (user == null) {
            redirectAttributes.addFlashAttribute("error", "사용자를 찾을 수 없습니다.");
            return null;
        }
        
        return permissionHelper.checkFeaturePermission(user, feature, redirectAttributes);
    }
    
    // 학교 권한 체크 메서드
    private User checkSchoolPermission(Feature feature, Long schoolId, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            redirectAttributes.addFlashAttribute("error", "로그인이 필요합니다.");
            return null;
        }
        
        User user = userService.findByUsername(auth.getName())
            .orElse(null);
        if (user == null) {
            redirectAttributes.addFlashAttribute("error", "사용자를 찾을 수 없습니다.");
            return null;
        }
        
        return permissionHelper.checkSchoolPermission(user, feature, schoolId, redirectAttributes);
    }

    // 학교 목록 API (평면도 페이지용)
    @GetMapping("/api/schools")
    @ResponseBody
    public ResponseEntity<List<School>> getAllSchoolsApi() {
        try {
            List<School> schools = schoolService.getAllSchools();
            return ResponseEntity.ok(schools);
        } catch (Exception e) {
            log.error("학교 목록 조회 실패", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/manage")
    public String manageSchools(Model model, RedirectAttributes redirectAttributes) {
        // 권한 체크
        User user = checkPermission(Feature.SCHOOL_MANAGEMENT, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        List<School> schools = schoolService.getAllSchools();
        model.addAttribute("schools", schools);
        model.addAttribute("newSchool", new School());
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);
        
        return "school/manage";
    }

    @PostMapping("/add")
    public String addSchool(@ModelAttribute School school, RedirectAttributes redirectAttributes) {
        // 권한 체크
        User user = checkPermission(Feature.SCHOOL_MANAGEMENT, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        try {
            if (school.getSchoolName() == null || school.getSchoolName().trim().isEmpty()) {
                redirectAttributes.addFlashAttribute("error", "학교명을 입력해주세요.");
                return "redirect:/school/manage";
            }
            
            schoolService.saveSchool(school);
            redirectAttributes.addFlashAttribute("success", "학교가 성공적으로 추가되었습니다.");
            
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", "학교 추가 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return "redirect:/school/manage";
    }

    @PostMapping("/delete/{id}")
    public String deleteSchool(@PathVariable Long id, RedirectAttributes redirectAttributes) {
        // 권한 체크
        User user = checkPermission(Feature.SCHOOL_MANAGEMENT, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        try {
            schoolService.deleteSchool(id);
            redirectAttributes.addFlashAttribute("success", "학교가 성공적으로 삭제되었습니다.");
            
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", "학교 삭제 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return "redirect:/school/manage";
    }

    @GetMapping("/count")
    @ResponseBody
    public long getSchoolCount() {
        return schoolService.countAllSchools();
    }
} 