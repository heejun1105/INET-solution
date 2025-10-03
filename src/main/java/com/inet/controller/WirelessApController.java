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
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.ByteArrayResource;
import java.io.ByteArrayOutputStream;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.*;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Map;
import java.util.LinkedHashMap;
import org.apache.poi.ss.util.CellRangeAddress;
import java.util.HashSet;
import java.util.Set;
import java.util.ArrayList;
import java.util.HashMap;

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
        
        wirelessApService.updateWirelessApWithHistory(wirelessAp, user);
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
    
    // 학교별 무선AP 목록 조회 API (평면도 뷰어용)
    @GetMapping("/api/wireless-aps/school/{schoolId}")
    @ResponseBody
    @JsonView(Views.Summary.class)
    public ResponseEntity<List<WirelessAp>> getWirelessApsBySchoolId(@PathVariable Long schoolId) {
        try {
            log.info("Getting wireless APs for school id: {}", schoolId);
            
            School school = schoolService.getSchoolById(schoolId)
                    .orElseThrow(() -> new RuntimeException("School not found with id: " + schoolId));
            
            List<WirelessAp> wirelessAps = wirelessApService.getWirelessApsBySchool(school);
            
            log.info("Found {} wireless APs for school: {}", wirelessAps.size(), school.getSchoolName());
            
            return ResponseEntity.ok(wirelessAps);
            
        } catch (Exception e) {
            log.error("Error getting wireless APs for school id: {}", schoolId, e);
            return ResponseEntity.status(500).build();
        }
    }

    // 엑셀 다운로드
    @GetMapping("/excel")
    public ResponseEntity<ByteArrayResource> downloadExcel(
            @RequestParam(value = "schoolId", required = false) Long schoolId,
            @RequestParam(value = "classroomId", required = false) Long classroomId,
            RedirectAttributes redirectAttributes) {
        
        try {
            // 권한 체크
            User user = checkPermission(Feature.WIRELESS_AP_LIST, redirectAttributes);
            if (user == null) {
                return ResponseEntity.status(401).build();
            }

            List<WirelessAp> wirelessAps;
            String fileName = "무선AP_목록";

            if (schoolId != null) {
                School school = schoolService.getSchoolById(schoolId)
                        .orElseThrow(() -> new RuntimeException("School not found"));
                wirelessAps = wirelessApService.getWirelessApsBySchool(school);
                fileName += "_" + school.getSchoolName();
                
                if (classroomId != null) {
                    Classroom classroom = classroomService.getClassroomById(classroomId)
                            .orElseThrow(() -> new RuntimeException("Classroom not found"));
                    wirelessAps = wirelessAps.stream()
                            .filter(ap -> ap.getLocation() != null && ap.getLocation().getClassroomId().equals(classroomId))
                            .toList();
                    fileName += "_" + classroom.getRoomName();
                }
            } else {
                wirelessAps = wirelessApService.getAllWirelessAps();
            }

            fileName += "_" + LocalDate.now() + ".xlsx";

            // 엑셀 파일 생성
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            Workbook workbook = new XSSFWorkbook();
            
            // 첫 번째 시트: 총괄표
            createSummarySheet(workbook, wirelessAps);
            
            // 두 번째 시트: 무선AP 목록
            Sheet sheet = workbook.createSheet("무선AP 목록");

            // 헤더 스타일
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setFontHeightInPoints((short) 12);
            headerStyle.setFont(headerFont);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            // 데이터 스타일
            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setAlignment(HorizontalAlignment.CENTER);
            dataStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            dataStyle.setBorderTop(BorderStyle.THIN);
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);

            // 1행: 학교이름 + "무선 AP" 표기
            String schoolName = "";
            if (!wirelessAps.isEmpty() && wirelessAps.get(0).getSchool() != null) {
                schoolName = wirelessAps.get(0).getSchool().getSchoolName();
            }
            Row titleRow = sheet.createRow(0);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue(schoolName + " 무선 AP");
            titleCell.setCellStyle(headerStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 10)); // A1:K1 병합

            // 2행: 오늘날짜 표기 (A2에만 표시)
            Row dateRow = sheet.createRow(1);
            Cell dateCell = dateRow.createCell(0);
            dateCell.setCellValue(java.time.LocalDate.now().toString());
            dateCell.setCellStyle(headerStyle);
            // A2에만 날짜 표시, 병합 제거

            // 3행: 빈 행

            // 4행: 헤더 (학교컬럼 제거)
            Row headerRow = sheet.createRow(3);
            String[] headers = {"현위치", "교실구분", "신규라벨번호", "장비번호", "도입년도", "제조사", "모델", "MAC주소", "기존위치", "기존라벨번호", "속도"};
            
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, 4000);
            }

            // 데이터 행 생성 (4행부터 시작)
            int rowNum = 4;
            for (WirelessAp ap : wirelessAps) {
                Row row = sheet.createRow(rowNum++);
                
                row.createCell(0).setCellValue(ap.getLocation() != null ? ap.getLocation().getRoomName() : "");
                row.createCell(1).setCellValue(ap.getClassroomType() != null ? ap.getClassroomType() : "");
                row.createCell(2).setCellValue(ap.getNewLabelNumber() != null ? ap.getNewLabelNumber() : "");
                row.createCell(3).setCellValue(ap.getDeviceNumber() != null ? ap.getDeviceNumber() : "");
                row.createCell(4).setCellValue(ap.getAPYear() != null ? String.valueOf(ap.getAPYear().getYear()) : "");
                row.createCell(5).setCellValue(ap.getManufacturer() != null ? ap.getManufacturer() : "");
                row.createCell(6).setCellValue(ap.getModel() != null ? ap.getModel() : "");
                row.createCell(7).setCellValue(ap.getMacAddress() != null ? ap.getMacAddress() : "");
                row.createCell(8).setCellValue(ap.getPrevLocation() != null ? ap.getPrevLocation() : "");
                row.createCell(9).setCellValue(ap.getPrevLabelNumber() != null ? ap.getPrevLabelNumber() : "");
                row.createCell(10).setCellValue(ap.getSpeed() != null ? ap.getSpeed() : "");
                
                // 모든 셀에 스타일 적용
                for (int i = 0; i < 11; i++) {
                    row.getCell(i).setCellStyle(dataStyle);
                }
            }

            workbook.write(outputStream);
            workbook.close();

            ByteArrayResource resource = new ByteArrayResource(outputStream.toByteArray());

            HttpHeaders headers_response = new HttpHeaders();
            headers_response.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"");
            headers_response.add(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate");
            headers_response.add(HttpHeaders.PRAGMA, "no-cache");
            headers_response.add(HttpHeaders.EXPIRES, "0");

            return ResponseEntity.ok()
                    .headers(headers_response)
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(resource);

        } catch (Exception e) {
            log.error("Error generating Excel file: ", e);
            return ResponseEntity.status(500).build();
        }
    }

    private void createSummarySheet(Workbook workbook, List<WirelessAp> wirelessAps) {
        Sheet summarySheet = workbook.createSheet("총괄표");
        
        // 스타일 정의
        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerFont.setFontHeightInPoints((short) 12);
        headerStyle.setFont(headerFont);
        headerStyle.setAlignment(HorizontalAlignment.CENTER);
        headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
        headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        headerStyle.setBorderTop(BorderStyle.THIN);
        headerStyle.setBorderBottom(BorderStyle.THIN);
        headerStyle.setBorderLeft(BorderStyle.THIN);
        headerStyle.setBorderRight(BorderStyle.THIN);

        CellStyle dataStyle = workbook.createCellStyle();
        dataStyle.setAlignment(HorizontalAlignment.CENTER);
        dataStyle.setVerticalAlignment(VerticalAlignment.CENTER);
        dataStyle.setBorderTop(BorderStyle.THIN);
        dataStyle.setBorderBottom(BorderStyle.THIN);
        dataStyle.setBorderLeft(BorderStyle.THIN);
        dataStyle.setBorderRight(BorderStyle.THIN);

        // 1행: 학교이름 + "무선 AP" 표기
        String schoolName = "";
        if (!wirelessAps.isEmpty() && wirelessAps.get(0).getSchool() != null) {
            schoolName = wirelessAps.get(0).getSchool().getSchoolName();
        }
        Row titleRow = summarySheet.createRow(0);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue(schoolName + " 무선 AP");
        titleCell.setCellStyle(headerStyle);
        summarySheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 6)); // A1:G1 병합

        // 2행: 오늘날짜 표기 (A2에만 표시)
        Row dateRow = summarySheet.createRow(1);
        Cell dateCell = dateRow.createCell(0);
        dateCell.setCellValue(java.time.LocalDate.now().toString());
        dateCell.setCellStyle(headerStyle);
        // A2에만 날짜 표시, 병합 제거

        // 3행: 빈 행 (AP 제목 제거)

        // 데이터 그룹핑 및 처리 (도입년도 옛날순 정렬)
        Map<String, Map<String, Map<String, Map<String, Integer>>>> groupedData = new LinkedHashMap<>();
        Set<String> allClassroomTypes = new HashSet<>();
        
        for (WirelessAp ap : wirelessAps) {
            String year = ap.getAPYear() != null ? ap.getAPYear().getYear() + "년" : "";
            String manufacturer = ap.getManufacturer() != null ? ap.getManufacturer() : "";
            String model = ap.getModel() != null ? ap.getModel() : "";
            String classroomType = ap.getClassroomType() != null ? ap.getClassroomType() : "";
            
            if (!classroomType.isEmpty()) {
                allClassroomTypes.add(classroomType);
            }
            
            groupedData.computeIfAbsent(year, k -> new LinkedHashMap<>())
                      .computeIfAbsent(manufacturer, k -> new LinkedHashMap<>())
                      .computeIfAbsent(model, k -> new LinkedHashMap<>())
                      .merge(classroomType, 1, Integer::sum);
        }

        // classroomType을 숫자 순으로 정렬
        List<String> sortedClassroomTypes = allClassroomTypes.stream()
            .sorted((t1, t2) -> {
                try {
                    int num1 = Integer.parseInt(t1);
                    int num2 = Integer.parseInt(t2);
                    return Integer.compare(num1, num2);
                } catch (NumberFormatException e) {
                    return t1.compareTo(t2);
                }
            })
            .collect(java.util.stream.Collectors.toList());

        // 도입년도 옛날순으로 정렬
        List<String> sortedYears = groupedData.keySet().stream()
            .filter(year -> !year.isEmpty())
            .sorted((y1, y2) -> {
                int year1 = Integer.parseInt(y1.replace("년", ""));
                int year2 = Integer.parseInt(y2.replace("년", ""));
                return Integer.compare(year1, year2);
            })
            .collect(java.util.stream.Collectors.toList());

        // 4행: 헤더 (동적으로 classroomType 컬럼 생성)
        Row headerRow = summarySheet.createRow(3);
        List<String> headers = new ArrayList<>();
        headers.add("도입년도");
        headers.add("제조사");
        headers.add("모델명");
        headers.add("수량합계");
        
        // classroomType별 헤더 추가
        for (String classroomType : sortedClassroomTypes) {
            headers.add(classroomType);
        }
        
        for (int i = 0; i < headers.size(); i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers.get(i));
            cell.setCellStyle(headerStyle);
            summarySheet.setColumnWidth(i, 4000);
        }

        // 데이터 행 생성 (4행부터 시작)
        int rowNum = 4;
        Map<String, Integer> totalByClassroomType = new HashMap<>();
        
        for (String year : sortedYears) {
            Map<String, Map<String, Map<String, Integer>>> yearData = groupedData.get(year);
            
            for (Map.Entry<String, Map<String, Map<String, Integer>>> manufacturerEntry : yearData.entrySet()) {
                String manufacturer = manufacturerEntry.getKey();
                
                for (Map.Entry<String, Map<String, Integer>> modelEntry : manufacturerEntry.getValue().entrySet()) {
                    String model = modelEntry.getKey();
                    Map<String, Integer> classroomCounts = modelEntry.getValue();
                    
                    Row row = summarySheet.createRow(rowNum++);
                    
                    row.createCell(0).setCellValue(year);
                    row.createCell(1).setCellValue(manufacturer);
                    row.createCell(2).setCellValue(model);
                    
                    // 수량합계 계산
                    int total = classroomCounts.values().stream().mapToInt(Integer::intValue).sum();
                    row.createCell(3).setCellValue(total);
                    
                    // classroomType별 데이터 입력
                    for (int i = 0; i < sortedClassroomTypes.size(); i++) {
                        String classroomType = sortedClassroomTypes.get(i);
                        int count = classroomCounts.getOrDefault(classroomType, 0);
                        row.createCell(4 + i).setCellValue(count);
                        
                        // 총계 누적
                        totalByClassroomType.merge(classroomType, count, Integer::sum);
                    }
                    
                    // 모든 셀에 스타일 적용
                    for (int i = 0; i < headers.size(); i++) {
                        row.getCell(i).setCellStyle(dataStyle);
                    }
                }
            }
        }

        // 총계 행
        Row totalRow = summarySheet.createRow(rowNum);
        totalRow.createCell(0).setCellValue("총계");
        totalRow.createCell(1).setCellValue("");
        totalRow.createCell(2).setCellValue("");
        
        // 수량합계 총계
        int grandTotal = totalByClassroomType.values().stream().mapToInt(Integer::intValue).sum();
        totalRow.createCell(3).setCellValue(grandTotal);
        
        // classroomType별 총계
        for (int i = 0; i < sortedClassroomTypes.size(); i++) {
            String classroomType = sortedClassroomTypes.get(i);
            int total = totalByClassroomType.getOrDefault(classroomType, 0);
            totalRow.createCell(4 + i).setCellValue(total);
        }
        
        // 총계 행에 스타일 적용
        for (int i = 0; i < headers.size(); i++) {
            totalRow.getCell(i).setCellStyle(dataStyle);
        }
    }
} 