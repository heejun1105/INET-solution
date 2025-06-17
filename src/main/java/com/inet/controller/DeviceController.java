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
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.stream.Collectors;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import com.fasterxml.jackson.annotation.JsonView;
import com.inet.entity.Manage;
import com.inet.service.UidService;
import com.inet.entity.Uid;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Comparator;

@Controller
@RequestMapping("/device")
@RequiredArgsConstructor
public class DeviceController {

    private static final Logger log = LoggerFactory.getLogger(DeviceController.class);
    
    private final DeviceService deviceService;
    private final SchoolService schoolService;
    private final OperatorService operatorService;
    private final ClassroomService classroomService;
    private final ManageService manageService;
    private final UidService uidService;

    @GetMapping("/list")
    public String list(@RequestParam(required = false) Long schoolId,
                      @RequestParam(required = false) String type,
                      @RequestParam(required = false) Long classroomId,
                      @RequestParam(required = false) String classroomName,
                      @RequestParam(defaultValue = "1") int page,
                      @RequestParam(defaultValue = "16") int size,
                      Model model) {
        
        // 학교 목록
        List<School> schools = schoolService.getAllSchools();
        model.addAttribute("schools", schools);
        
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
        return "device/list";
    }

    @GetMapping("/register")
    public String registerForm(Model model) {
        model.addAttribute("device", new Device());
        model.addAttribute("schools", schoolService.getAllSchools());
        model.addAttribute("classrooms", classroomService.getAllClassrooms());
        model.addAttribute("types", deviceService.getAllTypes());
        return "device/register";
    }

    @PostMapping("/register")
    public String register(Device device, String operatorName, String operatorPosition, String location,
                          String manageCate, String manageCateCustom, String manageYear, String manageYearCustom, String manageNum, String manageNumCustom,
                          String uidCate, String uidCateCustom, String uidYear, String uidYearCustom, String uidNum, String uidNumCustom) {
        
        log.info("Registering device: {}", device);
        log.info("Operator: {}, {}", operatorName, operatorPosition);
        log.info("Location: {}", location);
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

        // 교실 정보 처리
        Classroom classroom = null;
        if (location != null && !location.trim().isEmpty()) {
            classroom = classroomService.findByRoomName(location);
            if (classroom == null) {
                classroom = new Classroom();
                classroom.setRoomName(location);
                classroom.setSchool(device.getSchool());
                classroom.setXCoordinate(0);
                classroom.setYCoordinate(0);
                classroom.setWidth(100);
                classroom.setHeight(100);
                classroom = classroomService.saveClassroom(classroom);
            }
        }
        device.setClassroom(classroom);

        // 관리번호(Manage) 처리
        String cate = ("custom".equals(manageCate)) ? manageCateCustom : manageCate;
        Integer year = ("custom".equals(manageYear)) ? Integer.valueOf(manageYearCustom) : Integer.valueOf(manageYear);
        Long num = ("custom".equals(manageNum)) ? Long.valueOf(manageNumCustom) : Long.valueOf(manageNum);
        Manage manage = manageService.findOrCreate(device.getSchool(), cate, year, num);
        device.setManage(manage);

        // 고유번호(Uid) 처리
        String finalUidCate = ("custom".equals(uidCate)) ? uidCateCustom : uidCate;
        String finalUidYear = ("custom".equals(uidYear)) ? uidYearCustom : uidYear;
        Long finalUidNum = ("custom".equals(uidNum)) ? Long.valueOf(uidNumCustom) : Long.valueOf(uidNum);
        
        if (finalUidCate != null && !finalUidCate.trim().isEmpty()) {
            if (finalUidNum != null) {
                deviceService.setDeviceUidWithNumber(device, finalUidCate, finalUidNum);
            } else {
                deviceService.setDeviceUid(device, finalUidCate);
            }
        }

        deviceService.saveDevice(device);
        return "redirect:/device/list";
    }

    @GetMapping("/modify/{id}")
    public String modifyForm(@PathVariable Long id, Model model) {
        model.addAttribute("device", deviceService.getDeviceById(id).orElseThrow());
        model.addAttribute("schools", schoolService.getAllSchools());
        model.addAttribute("classrooms", classroomService.getAllClassrooms());
        model.addAttribute("types", deviceService.getAllTypes());
        return "device/modify";
    }

    @PostMapping("/modify")
    public String modify(Device device, String operatorName, String operatorPosition, String location,
                        String manageCate, String manageCateCustom, String manageYear, String manageYearCustom, String manageNum, String manageNumCustom,
                        String uidCate, String uidCateCustom, String uidYear, String uidYearCustom, String uidNum, String uidNumCustom,
                        Long idNumber) {
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

        // 교실 정보 처리
        Classroom classroom = null;
        if (location != null && !location.trim().isEmpty()) {
            classroom = classroomService.findByRoomName(location);
            if (classroom == null) {
                classroom = new Classroom();
                classroom.setRoomName(location);
                classroom.setSchool(device.getSchool());
                classroom.setXCoordinate(0);
                classroom.setYCoordinate(0);
                classroom.setWidth(100);
                classroom.setHeight(100);
                classroom = classroomService.saveClassroom(classroom);
            }
        }
        device.setClassroom(classroom);

        // 관리번호(Manage) 처리
        String cate = ("custom".equals(manageCate)) ? manageCateCustom : manageCate;
        Integer year = ("custom".equals(manageYear)) ? Integer.valueOf(manageYearCustom) : Integer.valueOf(manageYear);
        Long num = ("custom".equals(manageNum)) ? Long.valueOf(manageNumCustom) : Long.valueOf(manageNum);
        Manage manage = manageService.findOrCreate(device.getSchool(), cate, year, num);
        device.setManage(manage);

        // 고유번호(Uid) 처리
        String finalUidCate = ("custom".equals(uidCate)) ? uidCateCustom : uidCate;
        String finalUidYear = ("custom".equals(uidYear)) ? uidYearCustom : uidYear;
        Long finalUidNum = ("custom".equals(uidNum)) ? Long.valueOf(uidNumCustom) : Long.valueOf(uidNum);
        
        if (finalUidCate != null && !finalUidCate.trim().isEmpty()) {
            if (finalUidNum != null) {
                deviceService.setDeviceUidWithNumber(device, finalUidCate, finalUidNum);
            } else {
                deviceService.setDeviceUid(device, finalUidCate);
            }
        }

        deviceService.updateDevice(device);
        return "redirect:/device/list";
    }

    @PostMapping("/remove")
    public String remove(@RequestParam("device_id") Long deviceId) {
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
        
        deviceService.exportToExcel(devices, response.getOutputStream());
    }

    @GetMapping("/map")
    public String showMap(Model model) {
        model.addAttribute("schools", schoolService.getAllSchools());
        return "device/map";
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