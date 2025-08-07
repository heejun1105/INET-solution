package com.inet.controller;

import com.inet.entity.Feature;
import com.inet.entity.User;
import com.inet.service.WirelessApService;
import com.inet.service.SchoolService;
import com.inet.service.PermissionService;
import com.inet.service.SchoolPermissionService;
import com.inet.service.UserService;
import com.inet.config.PermissionHelper;
import com.inet.entity.School;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/wireless-ap/upload")
@RequiredArgsConstructor
public class WirelessApUploadController {
    private final WirelessApService wirelessApService;
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

    @GetMapping
    public String showUploadForm(Model model, RedirectAttributes redirectAttributes) {
        // 권한 체크
        User user = checkPermission(Feature.WIRELESS_AP_MANAGEMENT, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
        model.addAttribute("schools", schoolPermissionService.getAccessibleSchools(user));
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);
        
        return "wireless-ap/upload";
    }

    @PostMapping
    public String handleFileUpload(@RequestParam("file") MultipartFile file,
                                 @RequestParam("schoolId") Long schoolId,
                                 RedirectAttributes redirectAttributes) {
        // 권한 체크 (학교별 권한 체크)
        User user = checkSchoolPermission(Feature.WIRELESS_AP_MANAGEMENT, schoolId, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
        try {
            School school = schoolService.getSchoolById(schoolId)
                    .orElseThrow(() -> new IllegalArgumentException("선택된 학교를 찾을 수 없습니다."));
            
            wirelessApService.saveWirelessApsFromExcel(file, school);
            redirectAttributes.addFlashAttribute("message", "무선 AP 업로드 성공!");
        } catch (IllegalArgumentException e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", "업로드 중 오류가 발생했습니다: " + e.getMessage());
        }
        return "redirect:/wireless-ap/upload";
    }
} 