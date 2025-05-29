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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import java.time.LocalDate;
import java.util.List;

@Slf4j
@Controller
@RequestMapping("/wireless-ap")
@RequiredArgsConstructor
public class WirelessApController {

    private final WirelessApService wirelessApService;
    private final ClassroomService classroomService;
    private final SchoolService schoolService;

    @GetMapping("/list")
    public String list(@RequestParam(value = "schoolId", required = false) Long schoolId, Model model) {
        List<WirelessAp> wirelessAps;
        List<School> schools = schoolService.getAllSchools();
        
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
        return "wireless-ap/list";
    }

    @GetMapping("/register")
    public String registerForm(Model model) {
        model.addAttribute("wirelessAp", new WirelessAp());
        model.addAttribute("schools", schoolService.getAllSchools());
        return "wireless-ap/register";
    }

    @PostMapping("/register")
    public String register(WirelessAp wirelessAp, 
                          @RequestParam("schoolId") Long schoolId,
                          @RequestParam("locationName") String locationName,
                          @RequestParam(value = "apYear", required = false) Integer apYear) {
        log.info("Registering wireless AP: {}", wirelessAp);
        
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

    @GetMapping("/modify/{id}")
    public String modifyForm(@PathVariable Long id, Model model) {
        WirelessAp wirelessAp = wirelessApService.getWirelessApById(id)
                .orElseThrow(() -> new RuntimeException("Wireless AP not found with id: " + id));
        model.addAttribute("wirelessAp", wirelessAp);
        model.addAttribute("schools", schoolService.getAllSchools());
        return "wireless-ap/modify";
    }

    @PostMapping("/modify")
    public String modify(WirelessAp wirelessAp, 
                        @RequestParam("schoolId") Long schoolId,
                        @RequestParam("locationName") String locationName,
                        @RequestParam(value = "apYear", required = false) Integer apYear) {
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
    public String remove(@RequestParam("ap_id") Long apId) {
        log.info("Removing wireless AP with id: {}", apId);
        wirelessApService.deleteWirelessAp(apId);
        return "redirect:/wireless-ap/list";
    }
} 