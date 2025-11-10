package com.inet.controller;

import com.fasterxml.jackson.annotation.JsonView;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import com.inet.entity.Classroom;
import com.inet.entity.School;
import com.inet.service.ClassroomService;
import com.inet.service.SchoolService;
import com.inet.config.Views;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashMap;
import java.util.HashSet;
import java.util.stream.Collectors;
import jakarta.servlet.http.HttpSession;
import java.util.ArrayList;
import java.util.Optional;
import com.inet.entity.Feature;
import com.inet.entity.User;
import com.inet.service.PermissionService;
import com.inet.service.SchoolPermissionService;
import com.inet.service.UserService;
import com.inet.config.PermissionHelper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

@Controller
@RequestMapping("/classroom")
public class ClassroomController {

    private final ClassroomService classroomService;
    private final SchoolService schoolService;
    private final PermissionService permissionService;
    private final SchoolPermissionService schoolPermissionService;
    private final UserService userService;
    private final PermissionHelper permissionHelper;

    private static final Logger log = LoggerFactory.getLogger(ClassroomController.class);

    public record ClassroomUpdateRequest(
        Long classroomId,
        Long schoolId,
        String roomName
    ) { }

    public ClassroomController(ClassroomService classroomService, SchoolService schoolService, 
                             PermissionService permissionService, SchoolPermissionService schoolPermissionService, 
                             UserService userService, PermissionHelper permissionHelper) {
        this.classroomService = classroomService;
        this.schoolService = schoolService;
        this.permissionService = permissionService;
        this.schoolPermissionService = schoolPermissionService;
        this.userService = userService;
        this.permissionHelper = permissionHelper;
    }

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

    /**
     * 교실 관리 메인 페이지
     */
    @GetMapping("/manage")
    public String managePage(@RequestParam(value = "schoolId", required = false) Long schoolId, Model model, HttpSession session, RedirectAttributes redirectAttributes) {
        // 권한 체크 (학교별 권한 체크는 schoolId가 있을 때만)
        User user;
        if (schoolId != null) {
            user = checkSchoolPermission(Feature.CLASSROOM_MANAGEMENT, schoolId, redirectAttributes);
        } else {
            user = checkPermission(Feature.CLASSROOM_MANAGEMENT, redirectAttributes);
        }
        if (user == null) {
            return "redirect:/";
        }
        log.info("교실 관리 페이지 요청. schoolId: {}", schoolId);
        
        List<School> schools = schoolPermissionService.getAccessibleSchools(user);
        model.addAttribute("schools", schools);
        log.info("전체 학교 수: {}", schools.size());
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);
        
        if (schoolId != null) {
            return manageClassrooms(schoolId, model, session);
        }
        
        return "classroom/manage";
    }
    
    public String manageClassrooms(Long schoolId, Model model, HttpSession session) {
        log.info("교실 관리 페이지 접속 - 학교 ID: {}", schoolId);
        
        try {
            List<Classroom> classrooms = classroomService.findBySchoolId(schoolId);
            Map<String, List<Classroom>> duplicateGroups = classroomService.findDuplicateClassrooms(schoolId);
            
            // 세션에서 임시 중복 그룹 가져오기
            String tempSessionKey = "tempDuplicateGroup_" + schoolId;
            @SuppressWarnings("unchecked")
            Map<String, List<Classroom>> tempGroup = (Map<String, List<Classroom>>) session.getAttribute(tempSessionKey);
            if (tempGroup != null && !tempGroup.isEmpty()) {
                log.info("임시 중복 그룹 발견: {}", tempGroup.keySet());
                // 임시 그룹을 기존 중복 그룹에 추가
                duplicateGroups.putAll(tempGroup);
            }
            
            // 세션에서 제외된 그룹들을 가져와서 필터링
            @SuppressWarnings("unchecked")
            Set<String> excludedGroups = (Set<String>) session.getAttribute("excludedDuplicateGroups_" + schoolId);
            if (excludedGroups != null && !excludedGroups.isEmpty()) {
                log.info("세션에서 제외된 그룹들: {}", excludedGroups);
                duplicateGroups = duplicateGroups.entrySet().stream()
                    .filter(entry -> !excludedGroups.contains(entry.getKey()))
                    .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue
                    ));
            }
            
            model.addAttribute("selectedSchoolId", schoolId);
            model.addAttribute("classrooms", classrooms);
            model.addAttribute("duplicateGroups", duplicateGroups);
            
            log.info("교실 {}개, 중복 그룹 {}개 로드됨", classrooms.size(), duplicateGroups.size());
            
            return "classroom/manage";
        } catch (Exception e) {
            log.error("교실 관리 페이지 로드 중 오류: ", e);
            model.addAttribute("error", "교실 목록을 불러오는 중 오류가 발생했습니다.");
            return "classroom/manage";
        }
    }

    /**
     * 교실 추가
     */
    @PostMapping("/add")
    public String addClassroom(@RequestParam("schoolId") Long schoolId,
                              @RequestParam("roomName") String roomName,
                              RedirectAttributes redirectAttributes) {
        // 권한 체크 (학교별 권한 체크)
        User user = checkSchoolPermission(Feature.CLASSROOM_MANAGEMENT, schoolId, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
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
        // 권한 체크 (학교별 권한 체크)
        User user = checkSchoolPermission(Feature.CLASSROOM_MANAGEMENT, schoolId, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
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

    @PostMapping(
        value = "/update/ajax",
        consumes = MediaType.APPLICATION_JSON_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateClassroomAjax(
        @RequestBody ClassroomUpdateRequest request
    ) {
        Map<String, Object> response = new HashMap<>();

        if (request == null) {
            response.put("success", false);
            response.put("message", "요청 본문이 비어 있습니다.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        if (request.classroomId() == null) {
            response.put("success", false);
            response.put("message", "교실 ID가 필요합니다.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        if (request.schoolId() == null) {
            response.put("success", false);
            response.put("message", "학교 ID가 필요합니다.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            response.put("success", false);
            response.put("message", "로그인이 필요합니다.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }

        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            response.put("success", false);
            response.put("message", "사용자를 찾을 수 없습니다.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }

        if (!permissionService.hasPermission(user, Feature.CLASSROOM_MANAGEMENT)) {
            response.put("success", false);
            response.put("message", permissionHelper.getPermissionDeniedMessage(Feature.CLASSROOM_MANAGEMENT));
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
        }

        Optional<School> optionalSchool = schoolService.getSchoolById(request.schoolId());
        if (optionalSchool.isEmpty()) {
            response.put("success", false);
            response.put("message", "존재하지 않는 학교입니다.");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
        }

        School school = optionalSchool.get();
        if (!schoolPermissionService.hasSchoolPermission(user, school)) {
            response.put("success", false);
            response.put("message", "해당 학교에 대한 권한이 없습니다. 관리자에게 문의하세요.");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
        }

        Optional<Classroom> optionalClassroom = classroomService.getClassroomById(request.classroomId());
        if (optionalClassroom.isEmpty()) {
            response.put("success", false);
            response.put("message", "존재하지 않는 교실입니다.");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
        }

        Classroom classroom = optionalClassroom.get();
        if (classroom.getSchool() == null || !classroom.getSchool().getSchoolId().equals(school.getSchoolId())) {
            response.put("success", false);
            response.put("message", "선택한 학교에 속한 교실이 아닙니다.");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
        }

        String trimmedRoomName = request.roomName() != null ? request.roomName().trim() : "";
        if (trimmedRoomName.isEmpty()) {
            response.put("success", false);
            response.put("message", "교실명을 입력해주세요.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        try {
            classroom.setRoomName(trimmedRoomName);
            classroomService.updateClassroom(classroom);

            response.put("success", true);
            response.put("message", "교실명이 성공적으로 수정되었습니다.");
            response.put("classroomId", classroom.getClassroomId());
            response.put("roomName", classroom.getRoomName());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("교실 수정 중 오류 (AJAX): ", e);
            response.put("success", false);
            response.put("message", "교실 수정 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * 교실 삭제
     */
    @PostMapping("/delete")
    public String deleteClassroom(@RequestParam("classroomId") Long classroomId,
                                 @RequestParam("schoolId") Long schoolId,
                                 RedirectAttributes redirectAttributes) {
        // 권한 체크 (학교별 권한 체크)
        User user = checkSchoolPermission(Feature.CLASSROOM_MANAGEMENT, schoolId, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
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
                                 RedirectAttributes redirectAttributes,
                                 HttpSession session) {
        // 권한 체크 (학교별 권한 체크)
        User user = checkSchoolPermission(Feature.CLASSROOM_MANAGEMENT, schoolId, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
        try {
            classroomService.mergeClassrooms(targetId, sourceIds, newRoomName);
            
            // 병합 후 임시 그룹 정리
            String tempSessionKey = "tempDuplicateGroup_" + schoolId;
            session.removeAttribute(tempSessionKey);
            log.info("교실 병합 후 임시 그룹 정리 완료");
            
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
    public Map<String, Object> getClassroomUsage(@PathVariable Long classroomId) {
        log.info("교실 사용 현황 조회 API 호출. classroomId: {}", classroomId);
        
        try {
            ClassroomService.ClassroomUsageInfo usageInfo = classroomService.getClassroomUsage(classroomId);
            log.info("교실 {}의 사용 현황: 장비 {}개, 무선AP {}개", 
                    classroomId, usageInfo.getDeviceCount(), usageInfo.getWirelessApCount());
            
            Map<String, Object> response = Map.of(
                "classroomId", usageInfo.getClassroomId(),
                "deviceCount", usageInfo.getDeviceCount(),
                "wirelessApCount", usageInfo.getWirelessApCount(),
                "totalCount", usageInfo.getTotalCount(),
                "isEmpty", usageInfo.isEmpty()
            );
            
            return response;
        } catch (Exception e) {
            log.error("교실 사용 현황 조회 중 오류: ", e);
            // 에러 발생 시 기본값 반환
            return Map.of(
                "classroomId", classroomId,
                "deviceCount", 0,
                "wirelessApCount", 0,
                "totalCount", 0,
                "isEmpty", true,
                "error", e.getMessage()
            );
        }
    }

    /**
     * 교실 중복 그룹 조회 API
     */
    @GetMapping("/api/duplicates/{schoolId}")
    @ResponseBody
    @JsonView(Views.Summary.class)
    public Map<String, List<Classroom>> getDuplicateClassrooms(@PathVariable Long schoolId) {
        log.info("교실 중복 그룹 조회 API 호출. schoolId: {}", schoolId);
        return classroomService.findDuplicateClassrooms(schoolId);
    }

    /**
     * 중복 그룹을 세션에서 제외하는 API
     */
    @PostMapping("/exclude-duplicate-group")
    @ResponseBody
    public Map<String, Object> excludeDuplicateGroup(
            @RequestParam Long schoolId, 
            @RequestParam String groupKey, 
            HttpSession session) {
        
        log.info("중복 그룹 제외 요청 - 학교 ID: {}, 그룹 키: {}", schoolId, groupKey);
        
        try {
            // 세션에서 제외된 그룹 목록 가져오기 (없으면 새로 생성)
            String sessionKey = "excludedDuplicateGroups_" + schoolId;
            @SuppressWarnings("unchecked")
            Set<String> excludedGroups = (Set<String>) session.getAttribute(sessionKey);
            if (excludedGroups == null) {
                excludedGroups = new HashSet<>();
            }
            
            // 그룹 키 추가
            excludedGroups.add(groupKey);
            session.setAttribute(sessionKey, excludedGroups);
            
            log.info("그룹 '{}' 이 제외 목록에 추가됨. 현재 제외된 그룹: {}", groupKey, excludedGroups);
            
            return Map.of(
                "success", true,
                "message", "그룹이 성공적으로 제외되었습니다.",
                "excludedGroupsCount", excludedGroups.size()
            );
            
        } catch (Exception e) {
            log.error("중복 그룹 제외 중 오류: ", e);
            return Map.of(
                "success", false,
                "message", "그룹 제외 중 오류가 발생했습니다: " + e.getMessage()
            );
        }
    }
    
    /**
     * 모든 중복 그룹을 세션에서 제외하는 API
     */
    @PostMapping("/exclude-all-duplicate-groups")
    @ResponseBody
    public Map<String, Object> excludeAllDuplicateGroups(
            @RequestParam Long schoolId, 
            HttpSession session) {
        
        log.info("모든 중복 그룹 제외 요청 - 학교 ID: {}", schoolId);
        
        try {
            // 현재 중복 그룹들 조회
            Map<String, List<Classroom>> duplicateGroups = classroomService.findDuplicateClassrooms(schoolId);
            
            // 세션에서 제외된 그룹 목록 가져오기 (없으면 새로 생성)
            String sessionKey = "excludedDuplicateGroups_" + schoolId;
            @SuppressWarnings("unchecked")
            Set<String> excludedGroups = (Set<String>) session.getAttribute(sessionKey);
            if (excludedGroups == null) {
                excludedGroups = new HashSet<>();
            }
            
            // 모든 그룹 키 추가
            excludedGroups.addAll(duplicateGroups.keySet());
            session.setAttribute(sessionKey, excludedGroups);
            
            log.info("모든 그룹({})이 제외 목록에 추가됨. 현재 제외된 그룹: {}", duplicateGroups.size(), excludedGroups);
            
            return Map.of(
                "success", true,
                "message", "모든 그룹이 성공적으로 제외되었습니다.",
                "excludedGroupsCount", duplicateGroups.size()
            );
            
        } catch (Exception e) {
            log.error("모든 중복 그룹 제외 중 오류: ", e);
            return Map.of(
                "success", false,
                "message", "그룹 제외 중 오류가 발생했습니다: " + e.getMessage()
            );
        }
    }
    
    /**
     * 선택된 교실들을 임시 중복 그룹으로 추가하는 API
     */
    @PostMapping("/add-selected-as-duplicate-group")
    @ResponseBody
    public Map<String, Object> addSelectedAsDuplicateGroup(
            @RequestParam Long schoolId, 
            @RequestParam List<Long> classroomIds,
            HttpSession session) {
        
        log.info("선택된 교실들을 중복 그룹으로 추가 - 학교 ID: {}, 교실 IDs: {}", schoolId, classroomIds);
        
        try {
            if (classroomIds.size() < 2) {
                return Map.of(
                    "success", false,
                    "message", "최소 2개 이상의 교실을 선택해야 합니다."
                );
            }
            
            // 선택된 교실들 조회
            List<Classroom> selectedClassrooms = new ArrayList<>();
            for (Long classroomId : classroomIds) {
                Optional<Classroom> classroom = classroomService.getClassroomById(classroomId);
                if (classroom.isPresent() && classroom.get().getSchool().getSchoolId().equals(schoolId)) {
                    selectedClassrooms.add(classroom.get());
                }
            }
            
            if (selectedClassrooms.size() != classroomIds.size()) {
                return Map.of(
                    "success", false,
                    "message", "일부 교실을 찾을 수 없습니다."
                );
            }
            
            // 임시 그룹 키 생성 (선택된 교실명들로 조합)
            List<String> roomNames = selectedClassrooms.stream()
                .map(Classroom::getRoomName)
                .sorted() // 일관성을 위해 정렬
                .collect(Collectors.toList());
            
            String tempGroupKey;
            if (roomNames.size() <= 3) {
                // 3개 이하면 모든 교실명 표시
                tempGroupKey = String.join(", ", roomNames);
            } else {
                // 3개 초과면 처음 3개만 표시하고 나머지는 "외 N개"로 표시
                tempGroupKey = String.join(", ", roomNames.subList(0, 3)) + 
                              " 외 " + (roomNames.size() - 3) + "개";
            }
            
            // 그룹 키가 너무 길면 줄임
            if (tempGroupKey.length() > 50) {
                tempGroupKey = tempGroupKey.substring(0, 47) + "...";
            }
            
            // 세션에 임시 중복 그룹 저장
            String sessionKey = "tempDuplicateGroup_" + schoolId;
            Map<String, List<Classroom>> tempGroup = Map.of(tempGroupKey, selectedClassrooms);
            session.setAttribute(sessionKey, tempGroup);
            
            log.info("임시 중복 그룹 생성됨: 키={}, 교실 수={}", tempGroupKey, selectedClassrooms.size());
            
            return Map.of(
                "success", true,
                "message", "선택된 교실들이 중복교실 관리에 추가되었습니다.",
                "groupKey", tempGroupKey,
                "classroomCount", selectedClassrooms.size()
            );
            
        } catch (Exception e) {
            log.error("선택된 교실들을 중복 그룹으로 추가 중 오류: ", e);
            return Map.of(
                "success", false,
                "message", "선택된 교실들을 추가하는 중 오류가 발생했습니다: " + e.getMessage()
            );
        }
    }

    /**
     * 학교별 교실 목록 조회 API (평면도용)
     */
    @GetMapping("/api/school/{schoolId}/classrooms")
    @ResponseBody
    @JsonView(Views.Summary.class)
    public List<Classroom> getClassroomsBySchool(@PathVariable Long schoolId) {
        log.info("학교별 교실 목록 조회 API 호출. schoolId: {}", schoolId);
        
        try {
            List<Classroom> classrooms = classroomService.findBySchoolId(schoolId);
            log.info("학교 {}의 교실 {}개 조회됨", schoolId, classrooms.size());
            return classrooms;
        } catch (Exception e) {
            log.error("학교별 교실 목록 조회 중 오류: ", e);
            return new ArrayList<>();
        }
    }
} 