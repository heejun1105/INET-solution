package com.inet.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import com.inet.entity.Classroom;
import com.inet.entity.School;
import com.inet.service.ClassroomService;
import com.inet.service.SchoolService;
import com.inet.config.Views;
import com.fasterxml.jackson.annotation.JsonView;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Map;

@Slf4j
@Controller
@RequestMapping("/classroom")
@RequiredArgsConstructor
public class ClassroomController {

    private final ClassroomService classroomService;
    private final SchoolService schoolService;

    /**
     * 교실 관리 메인 페이지
     */
    @GetMapping("/manage")
    public String managePage(@RequestParam(value = "schoolId", required = false) Long schoolId, Model model) {
        log.info("교실 관리 페이지 요청. schoolId: {}", schoolId);
        
        List<School> schools = schoolService.getAllSchools();
        model.addAttribute("schools", schools);
        log.info("전체 학교 수: {}", schools.size());
        
        if (schoolId != null) {
            School selectedSchool = schoolService.getSchoolById(schoolId)
                    .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
            
            List<Classroom> classrooms = classroomService.findBySchoolId(schoolId);
            Map<String, List<Classroom>> duplicateGroups = classroomService.findDuplicateClassrooms(schoolId);
            
            log.info("선택된 학교: {}", selectedSchool.getSchoolName());
            log.info("해당 학교의 교실 수: {}", classrooms.size());
            log.info("중복 그룹 수: {}", duplicateGroups.size());
            
            // 각 교실 정보 로그
            for (Classroom classroom : classrooms) {
                log.info("교실: ID={}, 이름={}", classroom.getClassroomId(), classroom.getRoomName());
            }
            
            model.addAttribute("selectedSchool", selectedSchool);
            model.addAttribute("classrooms", classrooms);
            model.addAttribute("duplicateGroups", duplicateGroups);
            model.addAttribute("selectedSchoolId", schoolId);
        }
        
        return "classroom/manage";
    }

    /**
     * 교실 추가
     */
    @PostMapping("/add")
    public String addClassroom(@RequestParam("schoolId") Long schoolId,
                              @RequestParam("roomName") String roomName,
                              RedirectAttributes redirectAttributes) {
        try {
            School school = schoolService.getSchoolById(schoolId)
                    .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
            
            Classroom classroom = new Classroom();
            classroom.setSchool(school);
            classroom.setRoomName(roomName.trim());
            classroom.setXCoordinate(0);
            classroom.setYCoordinate(0);
            classroom.setWidth(100);
            classroom.setHeight(100);
            
            classroomService.saveClassroom(classroom);
            redirectAttributes.addFlashAttribute("success", "교실이 성공적으로 추가되었습니다.");
            
        } catch (Exception e) {
            log.error("교실 추가 중 오류: ", e);
            redirectAttributes.addFlashAttribute("error", "교실 추가 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return "redirect:/classroom/manage?schoolId=" + schoolId;
    }

    /**
     * 교실 이름 수정
     */
    @PostMapping("/update")
    public String updateClassroom(@RequestParam("classroomId") Long classroomId,
                                 @RequestParam("roomName") String roomName,
                                 @RequestParam("schoolId") Long schoolId,
                                 RedirectAttributes redirectAttributes) {
        try {
            Classroom classroom = classroomService.getClassroomById(classroomId)
                    .orElseThrow(() -> new RuntimeException("Classroom not found with id: " + classroomId));
            
            classroom.setRoomName(roomName.trim());
            classroomService.updateClassroom(classroom);
            
            redirectAttributes.addFlashAttribute("success", "교실명이 성공적으로 수정되었습니다.");
            
        } catch (Exception e) {
            log.error("교실 수정 중 오류: ", e);
            redirectAttributes.addFlashAttribute("error", "교실 수정 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return "redirect:/classroom/manage?schoolId=" + schoolId;
    }

    /**
     * 교실 삭제
     */
    @PostMapping("/delete")
    public String deleteClassroom(@RequestParam("classroomId") Long classroomId,
                                 @RequestParam("schoolId") Long schoolId,
                                 RedirectAttributes redirectAttributes) {
        try {
            classroomService.deleteClassroom(classroomId);
            redirectAttributes.addFlashAttribute("success", "교실이 성공적으로 삭제되었습니다.");
            
        } catch (IllegalStateException e) {
            log.warn("교실 삭제 실패 - 사용 중: ", e);
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        } catch (Exception e) {
            log.error("교실 삭제 중 오류: ", e);
            redirectAttributes.addFlashAttribute("error", "교실 삭제 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return "redirect:/classroom/manage?schoolId=" + schoolId;
    }

    /**
     * 교실 병합
     */
    @PostMapping("/merge")
    public String mergeClassrooms(@RequestParam("targetId") Long targetId,
                                 @RequestParam("sourceIds") List<Long> sourceIds,
                                 @RequestParam("newRoomName") String newRoomName,
                                 @RequestParam("schoolId") Long schoolId,
                                 RedirectAttributes redirectAttributes) {
        try {
            classroomService.mergeClassrooms(targetId, sourceIds, newRoomName);
            redirectAttributes.addFlashAttribute("success", "교실이 성공적으로 병합되었습니다.");
            
        } catch (Exception e) {
            log.error("교실 병합 중 오류: ", e);
            redirectAttributes.addFlashAttribute("error", "교실 병합 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return "redirect:/classroom/manage?schoolId=" + schoolId;
    }

    /**
     * 교실 사용 현황 조회 API
     */
    @GetMapping("/api/usage/{classroomId}")
    @ResponseBody
    @JsonView(Views.Summary.class)
    public ClassroomService.ClassroomUsageInfo getClassroomUsage(@PathVariable Long classroomId) {
        log.info("교실 사용 현황 조회 API 호출. classroomId: {}", classroomId);
        
        try {
            ClassroomService.ClassroomUsageInfo usageInfo = classroomService.getClassroomUsage(classroomId);
            log.info("교실 {}의 사용 현황: 장비 {}개, 무선AP {}개", 
                    classroomId, usageInfo.getDeviceCount(), usageInfo.getWirelessApCount());
            return usageInfo;
        } catch (Exception e) {
            log.error("교실 사용 현황 조회 중 오류: ", e);
            throw e;
        }
    }

    /**
     * 중복 교실 그룹 조회 API
     */
    @GetMapping("/api/duplicates/{schoolId}")
    @ResponseBody
    @JsonView(Views.Summary.class)
    public Map<String, List<Classroom>> getDuplicateClassrooms(@PathVariable Long schoolId) {
        return classroomService.findDuplicateClassrooms(schoolId);
    }
} 