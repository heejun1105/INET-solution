package com.inet.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import com.inet.entity.Device;
import com.inet.entity.Operator;
import com.inet.entity.School;
import com.inet.entity.Classroom;
import com.inet.service.DeviceService;
import com.inet.service.SchoolService;
import com.inet.service.OperatorService;
import com.inet.service.ClassroomService;
import com.inet.service.ManageService;
import com.inet.config.Views;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.Set;
import java.util.LinkedHashMap;
import java.util.Optional;
import java.util.stream.Collectors;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import com.fasterxml.jackson.annotation.JsonView;
import com.inet.entity.Manage;
import com.inet.service.UidService;
import com.inet.entity.Uid;
import com.inet.entity.Feature;
import com.inet.entity.User;
import com.inet.service.PermissionService;
import com.inet.service.SchoolPermissionService;
import com.inet.service.UserService;
import com.inet.service.DeviceInspectionHistoryService;
import com.inet.service.DeviceInspectionStatusService;
import com.inet.config.PermissionHelper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inet.entity.DeviceInspectionHistory;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.Comparator;

@Controller
@RequestMapping("/device")
public class DeviceController {

    private static final Logger log = LoggerFactory.getLogger(DeviceController.class);
    
    private final DeviceService deviceService;
    private final SchoolService schoolService;
    private final OperatorService operatorService;
    private final ClassroomService classroomService;
    private final ManageService manageService;
    private final UidService uidService;
    private final PermissionService permissionService;
    private final SchoolPermissionService schoolPermissionService;
    private final UserService userService;
    private final PermissionHelper permissionHelper;
    private final DeviceInspectionHistoryService deviceInspectionHistoryService;
    private final DeviceInspectionStatusService deviceInspectionStatusService;

    public DeviceController(DeviceService deviceService, SchoolService schoolService, 
                          OperatorService operatorService, ClassroomService classroomService, 
                          ManageService manageService, UidService uidService, 
                          PermissionService permissionService, SchoolPermissionService schoolPermissionService, 
                          UserService userService, PermissionHelper permissionHelper,
                          DeviceInspectionHistoryService deviceInspectionHistoryService,
                          DeviceInspectionStatusService deviceInspectionStatusService) {
        this.deviceService = deviceService;
        this.schoolService = schoolService;
        this.operatorService = operatorService;
        this.classroomService = classroomService;
        this.manageService = manageService;
        this.uidService = uidService;
        this.permissionService = permissionService;
        this.schoolPermissionService = schoolPermissionService;
        this.userService = userService;
        this.permissionHelper = permissionHelper;
        this.deviceInspectionHistoryService = deviceInspectionHistoryService;
        this.deviceInspectionStatusService = deviceInspectionStatusService;
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

    @GetMapping("/list")
    public String list(@RequestParam(required = false) Long schoolId,
                      @RequestParam(required = false) String type,
                      @RequestParam(required = false) Long classroomId,
                      @RequestParam(required = false) String classroomName,
                      @RequestParam(required = false) String searchKeyword,
                      @RequestParam(required = false) Boolean inspectionMode,
                      @RequestParam(required = false) Boolean showClassroomsWithDevices,
                      @RequestParam(defaultValue = "1") int page,
                      @RequestParam(defaultValue = "16") int size,
                      Model model,
                      RedirectAttributes redirectAttributes) {
        
        // 권한 체크 (학교별 권한 체크는 schoolId가 있을 때만)
        User user;
        if (schoolId != null) {
            user = checkSchoolPermission(Feature.DEVICE_LIST, schoolId, redirectAttributes);
        } else {
            user = checkPermission(Feature.DEVICE_LIST, redirectAttributes);
        }
        if (user == null) {
            return "redirect:/";
        }
        
        // 사용자가 접근 가능한 학교 목록만 표시
        List<School> schools = schoolPermissionService.getAccessibleSchools(user);
        model.addAttribute("schools", schools);
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);
        
        // 선택된 학교에 따른 교실 목록
        List<Classroom> classrooms;
        if (schoolId != null) {
            classrooms = classroomService.findBySchoolId(schoolId);
        } else {
            classrooms = classroomService.getAllClassrooms().stream()
                .collect(Collectors.collectingAndThen(
                    Collectors.toMap(
                        Classroom::getRoomName,
                        classroom -> classroom,
                        (existing, replacement) -> existing
                    ),
                    map -> new ArrayList<>(map.values())
                ))
                .stream()
                .sorted(Comparator.comparing(Classroom::getRoomName))
                .collect(Collectors.toList());
        }
        model.addAttribute("classrooms", classrooms);
        
        // 장비 유형 목록
        List<String> types = deviceService.getAllTypes();
        model.addAttribute("types", types);
        
        // 선택된 필터 값들
        model.addAttribute("selectedSchoolId", schoolId);
        model.addAttribute("selectedType", type);
        model.addAttribute("selectedClassroomId", classroomId);
        model.addAttribute("selectedClassroomName", classroomName);
        model.addAttribute("searchKeyword", searchKeyword);

        // 모든 장비를 가져와서 교실별로 정렬
        List<Device> allDevices;
        if (schoolId == null && classroomId != null) {
            String selectedClassroomName = classroomService.getClassroomById(classroomId)
                                                .map(Classroom::getRoomName)
                                                .orElse(null);
            
            if (selectedClassroomName != null && !selectedClassroomName.isEmpty()) {
                if (type != null && !type.isEmpty()) {
                    allDevices = deviceService.findByClassroomNameAndType(selectedClassroomName, type);
                } else {
                    allDevices = deviceService.findByClassroomName(selectedClassroomName);
                }
            } else {
                allDevices = deviceService.findFiltered(null, type, classroomId);
            }

        } else if (schoolId != null) {
            allDevices = deviceService.findFiltered(schoolId, type, classroomId);
        } else if (classroomName != null && !classroomName.isEmpty()) {
            if (type != null && !type.isEmpty()) {
                allDevices = deviceService.findByClassroomNameAndType(classroomName, type);
            } else {
                allDevices = deviceService.findByClassroomName(classroomName);
            }
        } else {
            allDevices = deviceService.findFiltered(null, type, null);
        }
        
        // 검색 키워드가 있으면 검색 실행
        if (searchKeyword != null && !searchKeyword.trim().isEmpty()) {
            if (showClassroomsWithDevices != null && showClassroomsWithDevices) {
                // "장비가 있는 교실" 체크박스가 체크된 경우
                // 먼저 검색어와 일치하는 장비들을 찾고, 그 장비들이 있는 교실의 모든 장비를 가져옴
                List<Device> matchingDevices = deviceService.searchDevices(schoolId, type, classroomId, searchKeyword);
                Set<String> classroomNames = matchingDevices.stream()
                    .filter(device -> device.getClassroom() != null && device.getClassroom().getRoomName() != null)
                    .map(device -> device.getClassroom().getRoomName())
                    .collect(Collectors.toSet());
                
                // 해당 교실들의 모든 장비를 가져옴
                allDevices = deviceService.findDevicesByClassroomNames(classroomNames, schoolId, type);
            } else {
                // 일반 검색
                allDevices = deviceService.searchDevices(schoolId, type, classroomId, searchKeyword);
            }
        } else if (showClassroomsWithDevices != null && showClassroomsWithDevices) {
            // 검색어가 없지만 "장비가 있는 교실" 체크박스가 체크된 경우
            // 모든 교실의 장비를 가져옴 (기본 필터링 결과 사용)
            // 이미 위에서 allDevices가 설정되었으므로 추가 처리 불필요
        }
        
        // 교실별로 정렬 (교실명 기준)
        allDevices.sort((d1, d2) -> {
            String classroom1 = d1.getClassroom() != null && d1.getClassroom().getRoomName() != null ? 
                             d1.getClassroom().getRoomName() : "미지정 교실";
            String classroom2 = d2.getClassroom() != null && d2.getClassroom().getRoomName() != null ? 
                             d2.getClassroom().getRoomName() : "미지정 교실";
            return classroom1.compareTo(classroom2);
        });
        
        // 교실별로 그룹화
        Map<String, List<Device>> devicesByClassroom = allDevices.stream()
            .collect(Collectors.groupingBy(device -> 
                device.getClassroom() != null && device.getClassroom().getRoomName() != null ? 
                device.getClassroom().getRoomName() : "미지정 교실",
                LinkedHashMap::new, Collectors.toList()
            ));
        
        // 각 교실 내에서 세트타입 > 담당자 순으로 정렬
        for (List<Device> devices : devicesByClassroom.values()) {
            devices.sort((d1, d2) -> {
                // 세트타입 기준 정렬 (있으면 우선)
                boolean hasSetType1 = d1.getSetType() != null && !d1.getSetType().trim().isEmpty();
                boolean hasSetType2 = d2.getSetType() != null && !d2.getSetType().trim().isEmpty();
                
                if (hasSetType1 && hasSetType2) {
                    int setTypeCompare = d1.getSetType().compareTo(d2.getSetType());
                    if (setTypeCompare != 0) return setTypeCompare;
                } else if (hasSetType1) {
                    return -1; // d1만 세트타입이 있으면 앞으로
                } else if (hasSetType2) {
                    return 1;  // d2만 세트타입이 있으면 앞으로
                }
                
                // 담당자 기준 정렬
                String operator1 = d1.getOperator() != null && d1.getOperator().getName() != null ? 
                                 d1.getOperator().getName() : "미지정 담당자";
                String operator2 = d2.getOperator() != null && d2.getOperator().getName() != null ? 
                                 d2.getOperator().getName() : "미지정 담당자";
                return operator1.compareTo(operator2);
            });
        }
        
        // 교실별 그룹을 페이징 처리를 위한 단일 리스트로 변환
        List<Device> paginatedDevices = new ArrayList<>();
        for (List<Device> classroomDevices : devicesByClassroom.values()) {
            paginatedDevices.addAll(classroomDevices);
        }
        
        // 페이징 처리
        int totalDevices = paginatedDevices.size();
        int totalPages = (int) Math.ceil((double) totalDevices / size);
        int fromIndex = (page - 1) * size;
        int toIndex = Math.min(fromIndex + size, totalDevices);
        
        List<Device> currentPageDevices = paginatedDevices.subList(fromIndex, toIndex);
        
        log.info("현재 페이지: {}, 장비 수: {}, 전체 장비 수: {}", page, currentPageDevices.size(), totalDevices);
        
        int startPage = ((page - 1) / 10) * 10 + 1;
        int endPage = Math.min(startPage + 9, totalPages);

        model.addAttribute("devices", currentPageDevices);
        model.addAttribute("currentPage", page);
        model.addAttribute("pageSize", size);
        model.addAttribute("startPage", startPage);
        model.addAttribute("endPage", endPage);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("inspectionMode", inspectionMode != null ? inspectionMode : false);
        model.addAttribute("showClassroomsWithDevices", showClassroomsWithDevices != null ? showClassroomsWithDevices : false);
        return "device/list";
    }

    @GetMapping("/register")
    public String registerForm(Model model, RedirectAttributes redirectAttributes) {
        // 권한 체크
        User user = checkPermission(Feature.DEVICE_MANAGEMENT, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        model.addAttribute("device", new Device());
        model.addAttribute("schools", schoolPermissionService.getAccessibleSchools(user));
        model.addAttribute("classrooms", classroomService.getAllClassrooms());
        model.addAttribute("types", deviceService.getAllTypes());
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);
        
        return "device/register";
    }

    @PostMapping("/register")
    public String register(Device device, String operatorName, String operatorPosition, String location, String locationCustom,
                          String manageCate, String manageCateCustom, String manageYear, String manageYearCustom, String manageNum, String manageNumCustom,
                          String uidCate, String uidCateCustom, String uidYear, String uidYearCustom, String uidNum, String uidNumCustom,
                          String purchaseYear, String purchaseMonth, RedirectAttributes redirectAttributes) {
        
        try {
        // 권한 체크 (학교별 권한 체크)
        User user = checkSchoolPermission(Feature.DEVICE_MANAGEMENT, device.getSchool().getSchoolId(), redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
        log.info("Registering device: {}", device);
        log.info("Operator: {}, {}", operatorName, operatorPosition);
        log.info("Location: {}, LocationCustom: {}", location, locationCustom);
        log.info("고유번호: cate={}, year={}, num={}", uidCate, uidYear, uidNum);

        // 담당자 정보 처리
        if (operatorName != null && !operatorName.trim().isEmpty() && 
            operatorPosition != null && !operatorPosition.trim().isEmpty()) {
            Operator operator = operatorService.findByNameAndPositionAndSchool(operatorName, operatorPosition, device.getSchool())
                .orElseGet(() -> {
                    Operator op = new Operator();
                    op.setName(operatorName);
                    op.setPosition(operatorPosition);
                    op.setSchool(device.getSchool());
                    return operatorService.saveOperator(op);
                });
            device.setOperator(operator);
        }

        // 도입일자 처리 (년/월을 LocalDate로 변환)
        if (purchaseYear != null && !purchaseYear.trim().isEmpty() && 
            purchaseMonth != null && !purchaseMonth.trim().isEmpty()) {
            try {
                int year = Integer.parseInt(purchaseYear.trim());
                int month = Integer.parseInt(purchaseMonth.trim());
                
                // 월 유효성 검사 (1-12)
                if (month >= 1 && month <= 12) {
                    LocalDate purchaseDate = LocalDate.of(year, month, 1); // 1일로 설정
                    device.setPurchaseDate(purchaseDate);
                    log.info("도입일자 설정: {}년 {}월", year, month);
                } else {
                    log.warn("잘못된 월 입력: {}", month);
                }
            } catch (NumberFormatException e) {
                log.warn("도입일자 파싱 오류: 년={}, 월={}", purchaseYear, purchaseMonth);
            }
        }

        // 교실 정보 처리
        String finalLocation = ("CUSTOM".equals(location)) ? locationCustom : location;
        Classroom classroom = null;
        if (finalLocation != null && !finalLocation.trim().isEmpty()) {
            // 학교와 교실명으로 검색
            classroom = classroomService.findByRoomNameAndSchool(finalLocation, device.getSchool().getSchoolId())
                .orElseGet(() -> {
                    // 교실이 없으면 새로 생성
                    Classroom newClassroom = new Classroom();
                    newClassroom.setRoomName(finalLocation);
                    newClassroom.setSchool(device.getSchool());
                    newClassroom.setXCoordinate(0);
                    newClassroom.setYCoordinate(0);
                    newClassroom.setWidth(100);
                    newClassroom.setHeight(100);
                    return classroomService.saveClassroom(newClassroom);
                });
        }
        device.setClassroom(classroom);

        // 관리번호(Manage) 처리
        String cate = ("custom".equals(manageCate)) ? manageCateCustom : manageCate;
        Integer year = null;
        if ("custom".equals(manageYear)) {
            if (manageYearCustom != null && !manageYearCustom.trim().isEmpty()) {
                year = Integer.valueOf(manageYearCustom.trim());
            }
        } else if (manageYear != null && !manageYear.trim().isEmpty() && !"없음".equals(manageYear)) {
            year = Integer.valueOf(manageYear);
        }
        Long num = ("custom".equals(manageNum)) ? Long.valueOf(manageNumCustom) : Long.valueOf(manageNum);
        Manage manage = manageService.findOrCreate(device.getSchool(), cate, year, num);
        device.setManage(manage);

        // 고유번호(Uid) 처리
        String finalUidCate = ("custom".equals(uidCate)) ? uidCateCustom : uidCate;
        String finalUidYear = null;
        if ("custom".equals(uidYear)) {
            finalUidYear = uidYearCustom;
        } else if (uidYear != null && !uidYear.trim().isEmpty() && !"XX".equals(uidYear)) {
            finalUidYear = uidYear;
        }
        Long finalUidNum = ("custom".equals(uidNum)) ? Long.valueOf(uidNumCustom) : Long.valueOf(uidNum);
        
        if (finalUidCate != null && !finalUidCate.trim().isEmpty()) {
            if (finalUidNum != null) {
                deviceService.setDeviceUidWithNumber(device, finalUidCate, finalUidNum);
            } else {
                deviceService.setDeviceUid(device, finalUidCate);
            }
        }

        deviceService.saveDevice(device);
        redirectAttributes.addFlashAttribute("successMessage", "장비가 성공적으로 등록되었습니다.");
        return "redirect:/device/list";
            
        } catch (Exception e) {
            log.error("장비 등록 중 오류 발생: ", e);
            String errorMessage = "장비 등록 중 오류가 발생했습니다: " + e.getMessage();
            redirectAttributes.addFlashAttribute("errorMessage", errorMessage);
            redirectAttributes.addFlashAttribute("errorDetails", e.toString());
            return "redirect:/device/register";
        }
    }

    @GetMapping("/modify/{id}")
    public String modifyForm(@PathVariable Long id, Model model, RedirectAttributes redirectAttributes) {
        // 장비 조회
        Device device = deviceService.getDeviceById(id)
                .orElseThrow(() -> new RuntimeException("Device not found with id: " + id));
        
        // 권한 체크 (학교별 권한 체크)
        User user = checkSchoolPermission(Feature.DEVICE_MANAGEMENT, device.getSchool().getSchoolId(), redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);
        model.addAttribute("device", deviceService.getDeviceById(id).orElseThrow());
        model.addAttribute("schools", schoolPermissionService.getAccessibleSchools(user));
        model.addAttribute("classrooms", classroomService.getAllClassrooms());
        model.addAttribute("types", deviceService.getAllTypes());
        return "device/modify";
    }

    @PostMapping("/modify")
    public String modify(Device device, String operatorName, String operatorPosition, String location, String locationCustom,
                        String manageCate, String manageCateCustom, String manageYear, String manageYearCustom, String manageNum, String manageNumCustom,
                        String uidCate, String uidCateCustom, String uidYear, String uidYearCustom, String uidNum, String uidNumCustom,
                        String purchaseYear, String purchaseMonth, Long idNumber, RedirectAttributes redirectAttributes) {
        
        // 권한 체크 (학교별 권한 체크)
        User user = checkSchoolPermission(Feature.DEVICE_MANAGEMENT, device.getSchool().getSchoolId(), redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        log.info("Modifying device: {}", device);

        // 담당자 정보 처리
        if (operatorName != null && !operatorName.trim().isEmpty() && 
            operatorPosition != null && !operatorPosition.trim().isEmpty()) {
            Operator operator = operatorService.findByNameAndPositionAndSchool(operatorName, operatorPosition, device.getSchool())
                .orElseGet(() -> {
                    Operator op = new Operator();
                    op.setName(operatorName);
                    op.setPosition(operatorPosition);
                    op.setSchool(device.getSchool());
                    return operatorService.saveOperator(op);
                });
            device.setOperator(operator);
        }

        // 도입일자 처리 (년/월을 LocalDate로 변환)
        if (purchaseYear != null && !purchaseYear.trim().isEmpty() && 
            purchaseMonth != null && !purchaseMonth.trim().isEmpty()) {
            try {
                int year = Integer.parseInt(purchaseYear.trim());
                int month = Integer.parseInt(purchaseMonth.trim());
                
                // 월 유효성 검사 (1-12)
                if (month >= 1 && month <= 12) {
                    LocalDate purchaseDate = LocalDate.of(year, month, 1); // 1일로 설정
                    device.setPurchaseDate(purchaseDate);
                    log.info("도입일자 설정: {}년 {}월", year, month);
                } else {
                    log.warn("잘못된 월 입력: {}", month);
                }
            } catch (NumberFormatException e) {
                log.warn("도입일자 파싱 오류: 년={}, 월={}", purchaseYear, purchaseMonth);
            }
        }

        // 교실 정보 처리
        String finalLocation = ("CUSTOM".equals(location)) ? locationCustom : location;
        Classroom classroom = null;
        if (finalLocation != null && !finalLocation.trim().isEmpty()) {
            // 학교와 교실명으로 검색
            classroom = classroomService.findByRoomNameAndSchool(finalLocation, device.getSchool().getSchoolId())
                .orElseGet(() -> {
                    // 교실이 없으면 새로 생성
                    Classroom newClassroom = new Classroom();
                    newClassroom.setRoomName(finalLocation);
                    newClassroom.setSchool(device.getSchool());
                    newClassroom.setXCoordinate(0);
                    newClassroom.setYCoordinate(0);
                    newClassroom.setWidth(100);
                    newClassroom.setHeight(100);
                    return classroomService.saveClassroom(newClassroom);
                });
        }
        device.setClassroom(classroom);

        // 관리번호(Manage) 처리
        String cate = ("custom".equals(manageCate)) ? manageCateCustom : manageCate;
        Integer year = null;
        if ("custom".equals(manageYear)) {
            if (manageYearCustom != null && !manageYearCustom.trim().isEmpty()) {
                year = Integer.valueOf(manageYearCustom.trim());
            }
        } else if (manageYear != null && !manageYear.trim().isEmpty() && !"없음".equals(manageYear)) {
            year = Integer.valueOf(manageYear);
        }
        Long num = ("custom".equals(manageNum)) ? Long.valueOf(manageNumCustom) : Long.valueOf(manageNum);
        Manage manage = manageService.findOrCreate(device.getSchool(), cate, year, num);
        device.setManage(manage);

        // 고유번호(Uid) 처리
        String finalUidCate = ("custom".equals(uidCate)) ? uidCateCustom : uidCate;
        String finalUidYear = null;
        if ("custom".equals(uidYear)) {
            finalUidYear = uidYearCustom;
        } else if (uidYear != null && !uidYear.trim().isEmpty() && !"XX".equals(uidYear)) {
            finalUidYear = uidYear;
        }
        Long finalUidNum = ("custom".equals(uidNum)) ? Long.valueOf(uidNumCustom) : Long.valueOf(uidNum);
        
        if (finalUidCate != null && !finalUidCate.trim().isEmpty()) {
            if (finalUidNum != null) {
                deviceService.setDeviceUidWithNumber(device, finalUidCate, finalUidNum);
            } else {
                deviceService.setDeviceUid(device, finalUidCate);
            }
        }

        try {
            // 장비 수정 및 히스토리 저장 (원본 장비는 서비스에서 조회)
            deviceService.updateDeviceWithHistory(device, user);
            redirectAttributes.addFlashAttribute("successMessage", "장비가 성공적으로 수정되었습니다.");
            return "redirect:/device/list";
        } catch (RuntimeException e) {
            log.error("장비 수정 중 오류 발생: {}", e.getMessage());
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
            return "redirect:/device/modify/" + device.getDeviceId();
        }
    }

    @PostMapping("/remove")
    public String remove(@RequestParam("device_id") Long deviceId, RedirectAttributes redirectAttributes) {
        // 장비 조회
        Device device = deviceService.getDeviceById(deviceId)
                .orElseThrow(() -> new RuntimeException("Device not found with id: " + deviceId));
        
        // 권한 체크 (학교별 권한 체크)
        User user = checkSchoolPermission(Feature.DEVICE_MANAGEMENT, device.getSchool().getSchoolId(), redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        log.info("Removing device: {}", deviceId);
        deviceService.deleteDevice(deviceId);
        return "redirect:/device/list";
    }

    @GetMapping("/excel")
    public void downloadExcel(
            @RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Long classroomId,
            HttpServletResponse response) throws IOException {
        
        // 권한 체크 (학교별 권한 체크는 schoolId가 있을 때만)
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "로그인이 필요합니다.");
            return;
        }
        
        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "사용자를 찾을 수 없습니다.");
            return;
        }
        
        if (schoolId != null) {
            User checkedUser = permissionHelper.checkSchoolPermission(user, Feature.DEVICE_LIST, schoolId, null);
            if (checkedUser == null) {
                response.sendError(HttpServletResponse.SC_FORBIDDEN, "해당 학교에 대한 권한이 없습니다.");
                return;
            }
        } else {
            User checkedUser = permissionHelper.checkFeaturePermission(user, Feature.DEVICE_LIST, null);
            if (checkedUser == null) {
                response.sendError(HttpServletResponse.SC_FORBIDDEN, "장비 목록 조회 권한이 없습니다.");
                return;
            }
        }
        List<Device> devices;
        
        if (schoolId != null && type != null && !type.isEmpty() && classroomId != null) {
            devices = deviceService.findBySchoolAndTypeAndClassroom(schoolId, type, classroomId);
        } else if (schoolId != null && type != null && !type.isEmpty()) {
            devices = deviceService.findBySchoolAndType(schoolId, type);
        } else if (schoolId != null && classroomId != null) {
            devices = deviceService.findBySchoolAndClassroom(schoolId, classroomId);
        } else if (schoolId != null) {
            devices = deviceService.findBySchool(schoolId);
        } else if (type != null && !type.isEmpty()) {
            devices = deviceService.findByType(type);
        } else if (classroomId != null) {
            devices = deviceService.findByClassroom(classroomId);
        } else {
            devices = deviceService.findAll();
        }
        
        // 교실, 세트 타입, 담당자 순으로 정렬
        devices.sort((d1, d2) -> {
            // 1. 교실 기준 정렬
            String classroom1 = d1.getClassroom() != null && d1.getClassroom().getRoomName() != null ? 
                                d1.getClassroom().getRoomName() : "미지정 교실";
            String classroom2 = d2.getClassroom() != null && d2.getClassroom().getRoomName() != null ? 
                                d2.getClassroom().getRoomName() : "미지정 교실";
            int classroomCompare = classroom1.compareTo(classroom2);
            if (classroomCompare != 0) return classroomCompare;
            
            // 2. 세트 타입 기준 정렬 (있는 경우)
            String setType1 = d1.getSetType() != null && !d1.getSetType().trim().isEmpty() ? d1.getSetType() : null;
            String setType2 = d2.getSetType() != null && !d2.getSetType().trim().isEmpty() ? d2.getSetType() : null;
            
            // 세트 타입이 있는 경우 우선 정렬
            if (setType1 != null && setType2 != null) {
                return setType1.compareTo(setType2);
            } else if (setType1 != null) {
                return -1; // d1이 세트 타입이 있으면 앞으로
            } else if (setType2 != null) {
                return 1;  // d2가 세트 타입이 있으면 앞으로
            }
            
            // 3. 담당자 기준 정렬
            String operator1 = d1.getOperator() != null && d1.getOperator().getName() != null ? 
                               d1.getOperator().getName() : "미지정 담당자";
            String operator2 = d2.getOperator() != null && d2.getOperator().getName() != null ? 
                               d2.getOperator().getName() : "미지정 담당자";
            return operator1.compareTo(operator2);
        });
        
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=devices.xlsx");
        
        // 검사모드에서 엑셀 다운로드인지 확인 (세션에서 검사 데이터 가져오기)
        Map<Long, String> inspectionStatuses = null;
        // TODO: 세션에서 검사 데이터를 가져오는 로직 추가
        
        deviceService.exportToExcel(devices, response.getOutputStream(), inspectionStatuses);
    }
    
    // 검사 데이터를 포함한 엑셀 다운로드
    @PostMapping("/excel/inspection")
    public void downloadExcelWithInspection(@RequestParam String inspectionData,
                                           @RequestParam(required = false) Long schoolId,
                                           @RequestParam(required = false) String type,
                                           @RequestParam(required = false) Long classroomId,
                                           HttpServletResponse response) throws IOException {
        
        // 권한 체크
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "로그인이 필요합니다.");
            return;
        }
        
        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "사용자를 찾을 수 없습니다.");
            return;
        }
        
        // 검사 데이터 파싱
        Map<Long, String> inspectionStatuses = new HashMap<>();
        log.info("받은 검사 데이터: {}", inspectionData);
        
        if (inspectionData != null && !inspectionData.trim().isEmpty()) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> parsedData = new ObjectMapper().readValue(inspectionData, Map.class);
                log.info("파싱된 검사 데이터: {}", parsedData);
                
                // 브라우저에서 전송하는 형식: {"success": true, "statuses": {"5965": "unchecked", ...}}
                if (parsedData.containsKey("statuses")) {
                    @SuppressWarnings("unchecked")
                    Map<String, String> statuses = (Map<String, String>) parsedData.get("statuses");
                    log.info("추출된 statuses: {}", statuses);
                    
                    for (Map.Entry<String, String> entry : statuses.entrySet()) {
                        try {
                            Long deviceId = Long.valueOf(entry.getKey());
                            String status = entry.getValue();
                            inspectionStatuses.put(deviceId, status);
                        } catch (NumberFormatException e) {
                            log.warn("잘못된 장비 ID 형식: {}", entry.getKey());
                        }
                    }
                } else {
                    // 기존 형식도 지원 (직접 Map<String, String> 형식)
                    for (Map.Entry<String, Object> entry : parsedData.entrySet()) {
                        try {
                            Long deviceId = Long.valueOf(entry.getKey());
                            String status = entry.getValue().toString();
                            inspectionStatuses.put(deviceId, status);
                        } catch (NumberFormatException e) {
                            log.warn("잘못된 장비 ID 형식: {}", entry.getKey());
                        }
                    }
                }
                log.info("최종 검사 상태 맵: {}", inspectionStatuses);
            } catch (Exception e) {
                log.error("검사 데이터 파싱 중 오류 발생. 데이터: {}", inspectionData, e);
                response.sendError(HttpServletResponse.SC_BAD_REQUEST, "검사 데이터 형식이 올바르지 않습니다.");
                return;
            }
        } else {
            log.info("검사 데이터가 비어있음. 일반 엑셀 다운로드로 진행");
        }
        
        // 장비 목록 조회
        List<Device> devices;
        if (schoolId != null && type != null && !type.isEmpty() && classroomId != null) {
            devices = deviceService.findBySchoolAndTypeAndClassroom(schoolId, type, classroomId);
        } else if (schoolId != null && type != null && !type.isEmpty()) {
            devices = deviceService.findBySchoolAndType(schoolId, type);
        } else if (schoolId != null && classroomId != null) {
            devices = deviceService.findBySchoolAndClassroom(schoolId, classroomId);
        } else if (schoolId != null) {
            devices = deviceService.findBySchool(schoolId);
        } else if (type != null && !type.isEmpty()) {
            devices = deviceService.findByType(type);
        } else if (classroomId != null) {
            devices = deviceService.findByClassroom(classroomId);
        } else {
            devices = deviceService.findAll();
        }
        
        // 교실, 세트 타입, 담당자 순으로 정렬
        devices.sort((d1, d2) -> {
            // 1. 교실 기준 정렬
            String classroom1 = d1.getClassroom() != null && d1.getClassroom().getRoomName() != null ? 
                                d1.getClassroom().getRoomName() : "미지정 교실";
            String classroom2 = d2.getClassroom() != null && d2.getClassroom().getRoomName() != null ? 
                                d2.getClassroom().getRoomName() : "미지정 교실";
            int classroomCompare = classroom1.compareTo(classroom2);
            if (classroomCompare != 0) return classroomCompare;
            
            // 2. 세트 타입 기준 정렬 (있는 경우)
            String setType1 = d1.getSetType() != null && !d1.getSetType().trim().isEmpty() ? d1.getSetType() : null;
            String setType2 = d2.getSetType() != null && !d2.getSetType().trim().isEmpty() ? d2.getSetType() : null;
            
            // 세트 타입이 있는 경우 우선 정렬
            if (setType1 != null && setType2 != null) {
                return setType1.compareTo(setType2);
            } else if (setType1 != null) {
                return -1; // d1이 세트 타입이 있으면 앞으로
            } else if (setType2 != null) {
                return 1;  // d2가 세트 타입이 있으면 앞으로
            }
            
            // 3. 담당자 기준 정렬
            String operator1 = d1.getOperator() != null && d1.getOperator().getName() != null ? 
                               d1.getOperator().getName() : "미지정 담당자";
            String operator2 = d2.getOperator() != null && d2.getOperator().getName() != null ? 
                               d2.getOperator().getName() : "미지정 담당자";
            return operator1.compareTo(operator2);
        });
        
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=devices_with_inspection.xlsx");
        
        deviceService.exportToExcel(devices, response.getOutputStream(), inspectionStatuses);
    }

    @GetMapping("/map")
    public String showMap(Model model) {
        model.addAttribute("schools", schoolService.getAllSchools());
        return "device/map";
    }

    // 장비검사 관련 API들
    // 검사 저장 API 제거 - 실시간 저장으로 대체됨
    
    @PostMapping("/inspection/status/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveInspectionStatus(@RequestBody Map<String, Object> statusData) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // 권한 체크
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) {
                response.put("success", false);
                response.put("message", "로그인이 필요합니다.");
                return ResponseEntity.status(401).body(response);
            }
            
            User user = userService.findByUsername(auth.getName()).orElse(null);
            if (user == null) {
                response.put("success", false);
                response.put("message", "사용자를 찾을 수 없습니다.");
                return ResponseEntity.status(401).body(response);
            }
            
            Long deviceId = Long.valueOf(statusData.get("deviceId").toString());
            Long schoolId = Long.valueOf(statusData.get("schoolId").toString());
            String status = statusData.get("status").toString();
            
            // 권한 체크
            User checkedUser = permissionHelper.checkSchoolPermission(user, Feature.DEVICE_INSPECTION, schoolId, null);
            if (checkedUser == null) {
                response.put("success", false);
                response.put("message", "해당 학교에 대한 장비검사 권한이 없습니다.");
                return ResponseEntity.status(403).body(response);
            }
            
            // 검사 상태 저장
            deviceInspectionStatusService.saveInspectionStatus(deviceId, schoolId, user.getId(), status);
            
            response.put("success", true);
            response.put("message", "검사 상태가 저장되었습니다.");
            
        } catch (Exception e) {
            log.error("검사 상태 저장 중 오류 발생", e);
            response.put("success", false);
            response.put("message", "저장 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/inspection/status/load")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> loadInspectionStatuses(@RequestParam Long schoolId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // 권한 체크
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) {
                response.put("success", false);
                response.put("message", "로그인이 필요합니다.");
                return ResponseEntity.status(401).body(response);
            }
            
            User user = userService.findByUsername(auth.getName()).orElse(null);
            if (user == null) {
                response.put("success", false);
                response.put("message", "사용자를 찾을 수 없습니다.");
                return ResponseEntity.status(401).body(response);
            }
            
            // 권한 체크
            User checkedUser = permissionHelper.checkSchoolPermission(user, Feature.DEVICE_INSPECTION, schoolId, null);
            if (checkedUser == null) {
                response.put("success", false);
                response.put("message", "해당 학교에 대한 장비검사 권한이 없습니다.");
                return ResponseEntity.status(403).body(response);
            }
            
            // 오늘의 검사 상태들 조회
            Map<Long, String> statuses = deviceInspectionStatusService.getInspectionStatuses(schoolId, user.getId());
            
            response.put("success", true);
            response.put("statuses", statuses);
            
        } catch (Exception e) {
            log.error("검사 상태 로드 중 오류 발생", e);
            response.put("success", false);
            response.put("message", "로드 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/api/schools")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> getSchools() {
        try {
            // 권한 체크
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) {
                return ResponseEntity.status(401).build();
            }
            
            User user = userService.findByUsername(auth.getName()).orElse(null);
            if (user == null) {
                return ResponseEntity.status(401).build();
            }
            
            // 사용자가 접근 가능한 학교 목록만 반환
            List<School> schools = schoolPermissionService.getAccessibleSchools(user);
            List<Map<String, Object>> schoolList = schools.stream()
                .map(school -> {
                    Map<String, Object> schoolData = new HashMap<>();
                    schoolData.put("schoolId", school.getSchoolId());
                    schoolData.put("schoolName", school.getSchoolName());
                    schoolData.put("address", ""); // School 엔티티에 address 필드가 없음
                    return schoolData;
                })
                .collect(Collectors.toList());
            
            return ResponseEntity.ok(schoolList);
            
        } catch (Exception e) {
            log.error("학교 목록 조회 중 오류 발생", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    // 검사이력 페이지
    @GetMapping("/inspection/history")
    public String inspectionHistory(@RequestParam(required = false) Long schoolId,
                                  @RequestParam(required = false) Long inspectorId,
                                  @RequestParam(required = false) String dateFilter,
                                  @RequestParam(defaultValue = "1") int page,
                                  @RequestParam(defaultValue = "20") int size,
                                  Model model) {
        
        // 권한 체크
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return "redirect:/login";
        }
        
        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            return "redirect:/login";
        }
        
        // 사용자가 접근 가능한 학교 목록
        List<School> accessibleSchools = schoolPermissionService.getAccessibleSchools(user);
        model.addAttribute("schools", accessibleSchools);
        
        // 검사자 목록 (사용자가 접근 가능한 학교의 검사자들)
        List<User> inspectors = userService.findInspectorsBySchools(
            accessibleSchools.stream().map(School::getSchoolId).collect(Collectors.toList()));
        model.addAttribute("inspectors", inspectors);
        
        // 검사 이력 조회
        List<DeviceInspectionHistory> histories;
        if (schoolId != null) {
            // 특정 학교의 검사 이력
            histories = deviceInspectionHistoryService.findBySchoolId(schoolId);
        } else if (inspectorId != null) {
            // 특정 검사자의 검사 이력
            histories = deviceInspectionHistoryService.findByInspectorId(inspectorId);
        } else {
            // 전체 검사 이력 (사용자가 접근 가능한 학교만)
            histories = deviceInspectionHistoryService.findRecentInspections(1000);
            // 권한이 있는 학교의 검사 이력만 필터링
            List<Long> accessibleSchoolIds = accessibleSchools.stream()
                .map(School::getSchoolId)
                .collect(Collectors.toList());
            histories = histories.stream()
                .filter(h -> accessibleSchoolIds.contains(h.getSchoolId()))
                .collect(Collectors.toList());
        }
        
        // 날짜 필터 적용
        if (dateFilter != null && !dateFilter.isEmpty()) {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime filterDate;
            
            switch (dateFilter) {
                case "today":
                    filterDate = now.toLocalDate().atStartOfDay();
                    break;
                case "week":
                    filterDate = now.minusWeeks(1);
                    break;
                case "month":
                    filterDate = now.minusMonths(1);
                    break;
                case "quarter":
                    filterDate = now.minusMonths(3);
                    break;
                default:
                    filterDate = null;
            }
            
            if (filterDate != null) {
                histories = histories.stream()
                    .filter(h -> h.getInspectionDate().isAfter(filterDate))
                    .collect(Collectors.toList());
            }
        }
        
        // 학교명과 검사자명 추가
        List<Map<String, Object>> historyList = histories.stream()
            .map(history -> {
                Map<String, Object> historyData = new HashMap<>();
                historyData.put("id", history.getId());
                historyData.put("inspectionDate", history.getInspectionDate());
                historyData.put("schoolId", history.getSchoolId());
                historyData.put("schoolName", schoolService.getSchoolById(history.getSchoolId())
                    .map(School::getSchoolName).orElse("알 수 없음"));
                historyData.put("inspectorId", history.getInspectorId());
                historyData.put("inspectorName", userService.findById(history.getInspectorId())
                    .map(User::getName).orElse("알 수 없음"));
                historyData.put("confirmedCount", history.getConfirmedCount());
                historyData.put("modifiedCount", history.getModifiedCount());
                historyData.put("unconfirmedCount", history.getUnconfirmedCount());
                historyData.put("totalCount", history.getTotalCount());
                return historyData;
            })
            .collect(Collectors.toList());
        
        // 통계 계산
        Map<String, Object> stats = new HashMap<>();
        stats.put("confirmedCount", historyList.stream().mapToInt(h -> (Integer) h.get("confirmedCount")).sum());
        stats.put("modifiedCount", historyList.stream().mapToInt(h -> (Integer) h.get("modifiedCount")).sum());
        stats.put("unconfirmedCount", historyList.stream().mapToInt(h -> (Integer) h.get("unconfirmedCount")).sum());
        stats.put("totalCount", historyList.stream().mapToInt(h -> (Integer) h.get("totalCount")).sum());
        
        model.addAttribute("inspectionHistories", historyList);
        model.addAttribute("stats", stats);
        model.addAttribute("selectedSchoolId", schoolId);
        model.addAttribute("selectedInspectorId", inspectorId);
        model.addAttribute("dateFilter", dateFilter);
        
        return "device/inspection-history";
    }

    @GetMapping("/api/classrooms")
    @ResponseBody
    @JsonView(Views.Summary.class)
    public List<Classroom> getAllClassrooms() {
        List<Classroom> allClassrooms = classroomService.getAllClassrooms();
        // 교실 이름 기준으로 중복 제거하고 가나다순 정렬
        return allClassrooms.stream()
            .collect(Collectors.collectingAndThen(
                Collectors.toMap(
                    Classroom::getRoomName,
                    classroom -> classroom,
                    (existing, replacement) -> existing
                ),
                map -> new ArrayList<>(map.values())
            ))
            .stream()
            .sorted(Comparator.comparing(Classroom::getRoomName))
            .collect(Collectors.toList());
    }

    @GetMapping("/api/classrooms/{schoolId}")
    @ResponseBody
    @JsonView(Views.Summary.class)
    public List<Classroom> getClassrooms(@PathVariable Long schoolId) {
        return classroomService.findBySchoolId(schoolId);
    }

    @GetMapping("/api/devices/{schoolId}")
    @ResponseBody
    public List<Device> getDevicesBySchool(@PathVariable Long schoolId) {
        return deviceService.findBySchool(schoolId);
    }

    @PostMapping("/api/save-layout")
    @ResponseBody
    public ResponseEntity<?> saveLayout(@RequestBody Map<String, Object> request) {
        try {
            Long schoolId = Long.parseLong(request.get("schoolId").toString());
            List<Map<String, Object>> rooms = (List<Map<String, Object>>) request.get("rooms");
            
            // 각 교실의 위치 정보를 저장
            for (Map<String, Object> room : rooms) {
                String roomName = (String) room.get("name");
                Map<String, Object> position = (Map<String, Object>) room.get("position");
                
                // 교실 정보 업데이트
                Classroom classroom = classroomService.findByRoomName(roomName);
                if (classroom != null) {
                    classroom.setXCoordinate((Integer) position.get("x"));
                    classroom.setYCoordinate((Integer) position.get("y"));
                    classroom.setWidth((Integer) position.get("width"));
                    classroom.setHeight((Integer) position.get("height"));
                    classroomService.updateClassroom(classroom);
                }
            }
            
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("레이아웃 저장 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/api/manages/{schoolId}")
    @ResponseBody
    public List<Manage> getManagesBySchool(@PathVariable Long schoolId) {
        return manageService.findBySchoolId(schoolId);
    }

    // 학교별 관리번호 카테고리 목록 조회
    @GetMapping("/api/manages/cates")
    @ResponseBody
    public List<String> getManageCatesBySchool(@RequestParam Long schoolId) {
        System.out.println("=== 카테고리 목록 조회 API 호출 ===");
        System.out.println("요청 schoolId: " + schoolId);
        try {
            List<String> result = manageService.getManageCatesBySchool(schoolId);
            System.out.println("조회된 카테고리 개수: " + result.size());
            System.out.println("조회된 카테고리 목록: " + result);
            return result;
        } catch (Exception e) {
            System.err.println("카테고리 목록 조회 중 오류 발생: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    // 학교 + 카테고리별 연도 목록 조회
    @GetMapping("/api/manages/years")
    @ResponseBody
    public List<Integer> getYearsBySchoolAndManageCate(@RequestParam Long schoolId, @RequestParam String manageCate) {
        log.info("=== 연도 목록 조회 ===");
        log.info("schoolId: {}, manageCate: {}", schoolId, manageCate);
        return manageService.getYearsBySchoolAndManageCate(schoolId, manageCate);
    }

    // 기존 관리번호 목록 + 다음 번호 조회 (연도 포함)
    @GetMapping("/api/manages/nums-with-year")
    @ResponseBody
    public List<Long> getManageNumsBySchoolAndManageCateAndYear(@RequestParam Long schoolId, @RequestParam String manageCate, @RequestParam Integer year) {
        log.info("=== API 호출 (연도 포함) ===");
        log.info("schoolId: {}, manageCate: {}, year: {}", schoolId, manageCate, year);
        return manageService.getManageNumsWithNext(schoolId, manageCate, year);
    }

    // 기존 관리번호 목록 + 다음 번호 조회 (연도 없음)
    @GetMapping("/api/manages/nums")
    @ResponseBody
    public List<Long> getManageNumsBySchoolAndManageCate(@RequestParam Long schoolId, @RequestParam String manageCate) {
        log.info("=== API 호출 디버깅 ===");
        log.info("schoolId: {}, manageCate: {}", schoolId, manageCate);
        
        List<Long> result = manageService.getManageNumsWithNext(schoolId, manageCate, null);
        log.info("최종 결과: {}", result);
        return result;
    }

    // 디버깅용 - 학교의 모든 Manage 데이터 조회 (Device 기반)
    @GetMapping("/api/debug/manages/{schoolId}")
    @ResponseBody
    public List<com.inet.entity.Manage> debugGetAllManages(@PathVariable Long schoolId) {
        return manageService.findBySchoolId(schoolId);
    }

    // 디버깅용 - Manage 테이블에서 직접 조회
    @GetMapping("/api/debug/manages-direct/{schoolId}")
    @ResponseBody
    public List<com.inet.entity.Manage> debugGetAllManagesDirect(@PathVariable Long schoolId) {
        return manageService.findDirectBySchoolId(schoolId);
    }

    // 고유번호 관련 API들

    // 학교별 고유번호 연도 목록 조회
    @GetMapping("/api/uids/years/{schoolId}/{cate}")
    @ResponseBody
    public List<String> getUidYearsBySchoolAndCate(@PathVariable Long schoolId, @PathVariable String cate) {
        log.info("=== 고유번호 연도 목록 조회 ===");
        log.info("schoolId: {}, cate: {}", schoolId, cate);
        
        try {
            List<String> years = uidService.getUidYearsBySchoolAndCate(schoolId, cate);
            log.info("Found years: {}", years);
            
            // 데이터가 없으면 기본 연도 반환
            if (years == null || years.isEmpty()) {
                log.info("No years found, returning default years");
                List<String> defaultYears = List.of("23", "24", "25");
                return defaultYears;
            }
            
            return years;
        } catch (Exception e) {
            log.error("고유번호 연도 조회 중 오류: ", e);
            // 오류 발생 시 기본 연도 반환
            return List.of("23", "24", "25");
        }
    }

    // 고유번호 번호 목록 + 다음 번호 조회
    @GetMapping("/api/uids/nums/{schoolId}/{cate}")
    @ResponseBody
    public List<Long> getUidNumsBySchoolAndCate(@PathVariable Long schoolId, @PathVariable String cate, @RequestParam(required = false) String year) {
        log.info("=== 고유번호 번호 목록 조회 ===");
        log.info("schoolId: {}, cate: {}, year: {}", schoolId, cate, year);
        
        try {
            List<Long> nums = uidService.getUidNumsWithNext(schoolId, cate, year);
            log.info("Found nums: {}", nums);
            
            // 데이터가 없으면 1번 반환
            if (nums == null || nums.isEmpty()) {
                log.info("No nums found, returning default num 1");
                return List.of(1L);
            }
            
            return nums;
        } catch (Exception e) {
            log.error("고유번호 번호 조회 중 오류: ", e);
            // 오류 발생 시 1번 반환
            return List.of(1L);
        }
    }

    // 고유번호 카테고리 목록 조회 (간단한 버전)
    @GetMapping("/api/uids/cates/{schoolId}")
    @ResponseBody
    public List<String> getUidCates(@PathVariable Long schoolId) {
        log.info("=== 고유번호 카테고리 목록 조회 ===");
        log.info("schoolId: {}", schoolId);
        
        try {
            // 먼저 학교가 존재하는지 확인
            Optional<School> schoolOpt = schoolService.getSchoolById(schoolId);
            if (schoolOpt.isEmpty()) {
                log.error("School with ID {} not found", schoolId);
                return List.of("DW", "MO", "PR", "TV", "ID", "ED", "DI", "TB", "PJ", "ET");
            }
            
            // Uid 테이블에 데이터가 있는지 확인
            List<Uid> allUids = uidService.getAllUids();
            log.info("Total UIDs in database: {}", allUids.size());
            
            List<String> cates = uidService.getUidCatesBySchool(schoolId);
            log.info("Found categories: {}", cates);
            
            // 데이터가 없으면 기본 카테고리 반환
            if (cates == null || cates.isEmpty()) {
                log.info("No categories found, returning default categories");
                List<String> defaultCates = List.of("DW", "MO", "PR", "TV", "ID", "ED", "DI", "TB", "PJ", "ET");
                return defaultCates;
            }
            
            return cates;
        } catch (Exception e) {
            log.error("고유번호 카테고리 조회 중 오류: ", e);
            e.printStackTrace(); // 스택 트레이스 출력
            // 오류 발생 시 기본 카테고리 반환
            return List.of("DW", "MO", "PR", "TV", "ID", "ED", "DI", "TB", "PJ", "ET");
        }
    }

    // 디버깅용 - 학교의 모든 Uid 데이터 조회
    @GetMapping("/api/debug/uids/{schoolId}")
    @ResponseBody
    public List<Uid> debugGetAllUids(@PathVariable Long schoolId) {
        log.info("=== 고유번호 디버깅 - 모든 UID 조회 ===");
        log.info("schoolId: {}", schoolId);
        List<Uid> uids = uidService.getUidsBySchoolId(schoolId);
        log.info("Found {} UIDs", uids.size());
        return uids;
    }
    
    // 디버깅용 - 간단한 카테고리 조회 테스트
    @GetMapping("/api/debug/test-cates/{schoolId}")
    @ResponseBody
    public Map<String, Object> debugTestCates(@PathVariable Long schoolId) {
        log.info("=== 간단한 카테고리 조회 테스트 ===");
        log.info("schoolId: {}", schoolId);
        
        Map<String, Object> result = new LinkedHashMap<>();
        
        try {
            // 1. 학교 존재 확인
            Optional<School> schoolOpt = schoolService.getSchoolById(schoolId);
            result.put("schoolExists", schoolOpt.isPresent());
            if (schoolOpt.isPresent()) {
                result.put("schoolName", schoolOpt.get().getSchoolName());
            }
            
            // 2. 모든 Uid 데이터 조회
            List<Uid> allUids = uidService.getAllUids();
            result.put("totalUids", allUids.size());
            
            // 3. 해당 학교의 Uid 데이터 조회
            List<Uid> schoolUids = uidService.getUidsBySchoolId(schoolId);
            result.put("schoolUids", schoolUids.size());
            
            // 4. 카테고리 직접 조회
            List<String> cates = uidService.getUidCatesBySchool(schoolId);
            result.put("categories", cates);
            
            result.put("success", true);
            
        } catch (Exception e) {
            log.error("테스트 중 오류: ", e);
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("errorType", e.getClass().getSimpleName());
        }
        
        return result;
    }
    
    // 테스트용 - 고유번호 테스트 데이터 생성
    @PostMapping("/api/debug/create-test-uids/{schoolId}")
    @ResponseBody
    public String createTestUids(@PathVariable Long schoolId) {
        log.info("=== 테스트 고유번호 데이터 생성 ===");
        log.info("schoolId: {}", schoolId);
        
        try {
            School school = schoolService.getSchoolById(schoolId).orElseThrow();
            
            // 기본 카테고리별 테스트 데이터 생성
            String[] categories = {"DW", "MO", "PR", "TV", "ID", "ED", "DI", "TB", "PJ", "ET"};
            String[] years = {"23", "24", "25"};
            
            int count = 0;
            for (String cate : categories) {
                for (String year : years) {
                    Uid uid = new Uid();
                    uid.setCate(cate);
                    uid.setIdNumber(1L);
                    uid.setMfgYear(year);
                    uid.setSchool(school);
                    uidService.saveUid(uid);
                    count++;
                }
            }
            
            return "테스트 데이터 " + count + "개 생성 완료";
        } catch (Exception e) {
            log.error("테스트 데이터 생성 중 오류: ", e);
            return "오류: " + e.getMessage();
        }
    }
} 