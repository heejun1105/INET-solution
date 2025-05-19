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

@Slf4j
@Controller
@RequestMapping("/device")
@RequiredArgsConstructor
public class DeviceController {

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
                      @RequestParam(defaultValue = "1") int page,
                      @RequestParam(defaultValue = "16") int size,
                      Model model) {
        
        model.addAttribute("schools", schoolService.getAllSchools());
        model.addAttribute("types", deviceService.getAllTypes());
        model.addAttribute("selectedSchoolId", schoolId);
        model.addAttribute("selectedType", type);
        model.addAttribute("selectedClassroomId", classroomId);

        // 선택된 학교의 교실 목록 조회
        if (schoolId != null) {
            model.addAttribute("classrooms", classroomService.findBySchoolId(schoolId));
        } else {
            model.addAttribute("classrooms", classroomService.getAllClassrooms());
        }

        // 모든 장비를 가져와서 교실별로 정렬
        List<Device> allDevices = deviceService.findFiltered(schoolId, type, classroomId);
        
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
        return "device/register";
    }

    @PostMapping("/register")
    public String register(Device device, String operatorName, String operatorPosition, String location,
                          String manageCate, String manageCateCustom, String manageYear, String manageYearCustom, String manageNum, String manageNumCustom,
                          String uidCate) {
        log.info("Registering device: {}", device);
        // 학교 정보 가져오기
        School school = device.getSchool();
        if (school == null) {
            throw new IllegalArgumentException("학교 정보가 필요합니다.");
        }
        // Operator 처리
        Operator operator = null;
        if (operatorName != null && operatorPosition != null) {
            operator = operatorService.findByNameAndPositionAndSchool(operatorName, operatorPosition, school)
                .orElseGet(() -> {
                    Operator op = new Operator();
                    op.setName(operatorName);
                    op.setPosition(operatorPosition);
                    op.setSchool(school);
                    return operatorService.saveOperator(op);
                });
        }
        device.setOperator(operator);
        // Classroom 처리
        Classroom classroom = null;
        if (location != null && !location.trim().isEmpty()) {
            classroom = classroomService.findByRoomName(location);
            if (classroom == null) {
                classroom = new Classroom();
                classroom.setRoomName(location);
                classroom.setSchool(school);
                classroom.setXCoordinate(0);
                classroom.setYCoordinate(0);
                classroom.setWidth(100);
                classroom.setHeight(100);
                classroom = classroomService.saveClassroom(classroom);
            }
        } else {
            throw new IllegalArgumentException("위치 정보가 필요합니다.");
        }
        device.setClassroom(classroom);
        // 관리번호(Manage) 처리
        String cate = ("custom".equals(manageCate)) ? manageCateCustom : manageCate;
        Integer year = ("custom".equals(manageYear)) ? Integer.valueOf(manageYearCustom) : Integer.valueOf(manageYear);
        Long num = ("custom".equals(manageNum)) ? Long.valueOf(manageNumCustom) : Long.valueOf(manageNum);
        Manage manage = manageService.findOrCreate(device.getSchool(), cate, year, num);
        device.setManage(manage);
        // Uid 처리
        if (uidCate != null && !uidCate.trim().isEmpty()) {
            deviceService.setDeviceUid(device, uidCate);
        }
        deviceService.saveDevice(device);
        return "redirect:/device/list";
    }

    @GetMapping("/modify/{id}")
    public String modifyForm(@PathVariable Long id, Model model) {
        model.addAttribute("device", deviceService.getDeviceById(id).orElseThrow());
        model.addAttribute("schools", schoolService.getAllSchools());
        model.addAttribute("classrooms", classroomService.getAllClassrooms());
        return "device/modify";
    }

    @PostMapping("/modify")
    public String modify(Device device, String operatorName, String operatorPosition, String location,
                        String manageCate, String manageCateCustom, String manageYear, String manageYearCustom, String manageNum, String manageNumCustom,
                        String uidCate, Long idNumber) {
        log.info("Modifying device: {}", device);
        School school = device.getSchool();
        // Operator 처리
        Operator operator = device.getOperator();
        if (operatorName != null && operatorPosition != null) {
            if (operator != null) {
                operator.setName(operatorName);
                operator.setPosition(operatorPosition);
                operator.setSchool(school);
                operatorService.updateOperator(operator);
            } else {
                operator = operatorService.findByNameAndPositionAndSchool(operatorName, operatorPosition, school)
                    .orElseGet(() -> {
                        Operator op = new Operator();
                        op.setName(operatorName);
                        op.setPosition(operatorPosition);
                        op.setSchool(school);
                        return operatorService.saveOperator(op);
                    });
                device.setOperator(operator);
            }
        }
        // Classroom 처리
        Classroom classroom = null;
        if (location != null && !location.trim().isEmpty()) {
            classroom = classroomService.findByRoomName(location);
            if (classroom == null) {
                classroom = new Classroom();
                classroom.setRoomName(location);
                classroom.setSchool(school);
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
        // Uid 처리
        if (uidCate != null && !uidCate.trim().isEmpty()) {
            if (idNumber != null) {
                deviceService.setDeviceUidWithNumber(device, uidCate, idNumber);
            } else {
                deviceService.setDeviceUid(device, uidCate);
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
} 