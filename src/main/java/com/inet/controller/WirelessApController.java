package com.inet.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import com.inet.entity.WirelessAp;
import com.inet.entity.Classroom;
import com.inet.entity.School;
import com.inet.service.WirelessApService;
import com.inet.service.ClassroomService;
import com.inet.service.SchoolService;
import com.inet.config.Views;
import com.fasterxml.jackson.annotation.JsonView;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import java.time.LocalDate;
import java.util.List;
import com.inet.entity.Feature;
import com.inet.entity.User;
import com.inet.service.PermissionService;
import com.inet.service.SchoolPermissionService;
import com.inet.service.UserService;
import com.inet.config.PermissionHelper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Slf4j
@Controller
@RequestMapping("/wireless-ap")
@RequiredArgsConstructor
public class WirelessApController {

    private final WirelessApService wirelessApService;
    private final ClassroomService classroomService;
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

    @GetMapping("/list")
    public String list(@RequestParam(value = "schoolId", required = false) Long schoolId, Model model, RedirectAttributes redirectAttributes) {
        // 권한 체크 (학교별 권한 체크는 schoolId가 있을 때만)
        User user;
        if (schoolId != null) {
            user = checkSchoolPermission(Feature.WIRELESS_AP_LIST, schoolId, redirectAttributes);
        } else {
            user = checkPermission(Feature.WIRELESS_AP_LIST, redirectAttributes);
        }
        if (user == null) {
            return "redirect:/";
        }
        List<WirelessAp> wirelessAps;
        List<School> schools = schoolPermissionService.getAccessibleSchools(user);
        
        if (schoolId != null) {
            School selectedSchool = schoolService.getSchoolById(schoolId)
                    .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
            wirelessAps = wirelessApService.getWirelessApsBySchool(selectedSchool);
            model.addAttribute("selectedSchoolId", schoolId);
        } else {
            wirelessAps = wirelessApService.getAllWirelessAps();
            // 학교별로 정렬
            wirelessAps.sort((ap1, ap2) -> {
                String school1 = ap1.getSchool() != null ? ap1.getSchool().getSchoolName() : "미지정";
                String school2 = ap2.getSchool() != null ? ap2.getSchool().getSchoolName() : "미지정";
                int schoolComparison = school1.compareTo(school2);
                if (schoolComparison != 0) return schoolComparison;
                
                String location1 = ap1.getLocation() != null && ap1.getLocation().getRoomName() != null ? 
                                 ap1.getLocation().getRoomName() : "미지정 교실";
                String location2 = ap2.getLocation() != null && ap2.getLocation().getRoomName() != null ? 
                                 ap2.getLocation().getRoomName() : "미지정 교실";
                return location1.compareTo(location2);
            });
        }
        
        model.addAttribute("wirelessAps", wirelessAps);
        model.addAttribute("schools", schools);
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);
        
        return "wireless-ap/list";
    }

    @GetMapping("/register")
    public String registerForm(Model model, RedirectAttributes redirectAttributes) {
        // 권한 체크
        User user = checkPermission(Feature.WIRELESS_AP_MANAGEMENT, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
        model.addAttribute("wirelessAp", new WirelessAp());
        model.addAttribute("schools", schoolPermissionService.getAccessibleSchools(user));
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);
        
        return "wireless-ap/register";
    }

    @PostMapping("/register")
    public String register(WirelessAp wirelessAp, 
                          @RequestParam("schoolId") Long schoolId,
                          @RequestParam("locationId") Long locationId,
                           @RequestParam(value = "apYear", required = false) Integer apYear,
                           RedirectAttributes redirectAttributes) {
        // 권한 체크 (학교별 권한 체크)
        User user = checkSchoolPermission(Feature.WIRELESS_AP_MANAGEMENT, schoolId, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
        log.info("Registering wireless AP: {}", wirelessAp);
        
        // 학교 설정
        School school = schoolService.getSchoolById(schoolId)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
        wirelessAp.setSchool(school);
        
        // APYear 설정 (년도만 입력받아서 LocalDate로 변환)
        if (apYear != null && apYear >= 1900 && apYear <= 2100) {
            wirelessAp.setAPYear(LocalDate.of(apYear, 1, 1));
        }
        
        // 교실 설정
        Classroom classroom = classroomService.getClassroomById(locationId)
                .orElseThrow(() -> new RuntimeException("Classroom not found with id: " + locationId));
        wirelessAp.setLocation(classroom);
        
        wirelessApService.saveWirelessAp(wirelessAp);
        return "redirect:/wireless-ap/list";
    }

    @GetMapping("/modify/{id}")
    public String modifyForm(@PathVariable Long id, Model model, RedirectAttributes redirectAttributes) {
        // 무선AP 조회
        WirelessAp wirelessAp = wirelessApService.getWirelessApById(id)
                .orElseThrow(() -> new RuntimeException("Wireless AP not found with id: " + id));
        
        // 권한 체크 (학교별 권한 체크)
        User user = checkSchoolPermission(Feature.WIRELESS_AP_MANAGEMENT, wirelessAp.getSchool().getSchoolId(), redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
        model.addAttribute("wirelessAp", wirelessAp);
        model.addAttribute("schools", schoolPermissionService.getAccessibleSchools(user));
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);
        
        return "wireless-ap/modify";
    }

    @PostMapping("/modify")
    public String modify(WirelessAp wirelessAp, 
                        @RequestParam("schoolId") Long schoolId,
                        @RequestParam("locationName") String locationName,
                        @RequestParam(value = "apYear", required = false) Integer apYear,
                        RedirectAttributes redirectAttributes) {
        // 권한 체크 (학교별 권한 체크)
        User user = checkSchoolPermission(Feature.WIRELESS_AP_MANAGEMENT, schoolId, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
        log.info("Modifying wireless AP: {}", wirelessAp);
        
        // 학교 설정
        School school = schoolService.getSchoolById(schoolId)
                .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
        wirelessAp.setSchool(school);
        
        // APYear 설정 (년도만 입력받아서 LocalDate로 변환)
        if (apYear != null && apYear >= 1900 && apYear <= 2100) {
            wirelessAp.setAPYear(LocalDate.of(apYear, 1, 1));
        }
        
        // 교실 처리
        if (locationName != null && !locationName.trim().isEmpty()) {
            var existingClassroom = classroomService.findByRoomNameAndSchool(locationName, schoolId);
            Classroom classroom;
            
            if (existingClassroom.isPresent()) {
                classroom = existingClassroom.get();
            } else {
                // 새로운 교실 생성
                classroom = new Classroom();
                classroom.setRoomName(locationName);
                classroom.setSchool(school);
                classroom.setXCoordinate(0);
                classroom.setYCoordinate(0);
                classroom.setWidth(100);
                classroom.setHeight(100);
                classroom = classroomService.saveClassroom(classroom);
            }
            wirelessAp.setLocation(classroom);
        }
        
        wirelessApService.saveWirelessAp(wirelessAp);
        return "redirect:/wireless-ap/list";
    }

    @PostMapping("/remove")
    public String remove(@RequestParam("ap_id") Long apId, RedirectAttributes redirectAttributes) {
        // 무선AP 조회
        WirelessAp wirelessAp = wirelessApService.getWirelessApById(apId)
                .orElseThrow(() -> new RuntimeException("Wireless AP not found with id: " + apId));
        
        // 권한 체크 (학교별 권한 체크)
        User user = checkSchoolPermission(Feature.WIRELESS_AP_MANAGEMENT, wirelessAp.getSchool().getSchoolId(), redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
        log.info("Removing wireless AP with id: {}", apId);
        wirelessApService.deleteWirelessAp(apId);
        return "redirect:/wireless-ap/list";
    }

    // 학교별 교실 목록 조회 API
    @GetMapping("/api/classrooms/{schoolId}")
    @ResponseBody
    @JsonView(Views.Summary.class)
    public List<Classroom> getClassroomsBySchool(@PathVariable Long schoolId) {
        log.info("Getting classrooms for school id: {}", schoolId);
        return classroomService.findBySchoolId(schoolId);
    }
} 