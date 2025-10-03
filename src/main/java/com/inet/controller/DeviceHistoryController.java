package com.inet.controller;

import com.inet.entity.DeviceHistory;
import com.inet.entity.School;
import com.inet.entity.User;
import com.inet.service.DeviceHistoryService;
import com.inet.service.SchoolService;
import com.inet.service.UserService;
import com.inet.config.PermissionHelper;
import com.inet.entity.Feature;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Controller
@RequestMapping("/device/history")
@Slf4j
public class DeviceHistoryController {
    
    private final DeviceHistoryService deviceHistoryService;
    private final SchoolService schoolService;
    private final UserService userService;
    private final PermissionHelper permissionHelper;
    
    public DeviceHistoryController(DeviceHistoryService deviceHistoryService, 
                                 SchoolService schoolService, 
                                 UserService userService, 
                                 PermissionHelper permissionHelper) {
        this.deviceHistoryService = deviceHistoryService;
        this.schoolService = schoolService;
        this.userService = userService;
        this.permissionHelper = permissionHelper;
    }
    
    /**
     * 장비수정내역 목록 페이지
     */
    @GetMapping("/list")
    public String list(@RequestParam(required = false) Long schoolId,
                      @RequestParam(required = false) String searchType,
                      @RequestParam(required = false) String searchKeyword,
                      @RequestParam(defaultValue = "1") int page,
                      @RequestParam(defaultValue = "12") int size,
                      Model model,
                      RedirectAttributes redirectAttributes) {
        
        // 권한 체크
        User user = checkPermission(Feature.DEVICE_LIST, redirectAttributes);
        if (user == null) {
            return "redirect:/auth/login";
        }
        
        // 학교 목록 조회
        List<School> schools = schoolService.getAllSchools();
        model.addAttribute("schools", schools);
        
        // 장비 유형 목록 조회
        List<String> types = deviceHistoryService.getAllDeviceTypes();
        model.addAttribute("types", types);
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);
        
        // 학교 선택 여부에 따른 처리
        Page<DeviceHistory> historyPage;
        School selectedSchool = null;
        
        if (schoolId != null) {
            // 학교 권한 체크
            user = checkSchoolPermission(Feature.DEVICE_LIST, schoolId, redirectAttributes);
            if (user == null) {
                return "redirect:/device/list";
            }
            
            // 특정 학교의 수정내역 조회
            if (searchType != null && !searchType.isEmpty() || 
                searchKeyword != null && !searchKeyword.trim().isEmpty()) {
                historyPage = deviceHistoryService.getDeviceHistoryBySchoolAndSearch(
                    schoolId, searchType, searchKeyword, page, size);
            } else {
                historyPage = deviceHistoryService.getDeviceHistoryBySchool(schoolId, page, size);
            }
            
            // 선택된 학교 정보
            selectedSchool = schoolService.getSchoolById(schoolId).orElse(null);
        } else {
            // 학교가 선택되지 않은 경우 빈 페이지 반환
            historyPage = null;
        }
        
        model.addAttribute("historyPage", historyPage);
        model.addAttribute("selectedSchool", selectedSchool);
        model.addAttribute("schoolId", schoolId);
        model.addAttribute("searchType", searchType);
        model.addAttribute("searchKeyword", searchKeyword);
        model.addAttribute("currentPage", page);
        model.addAttribute("pageSize", size);
        
        return "device/history";
    }
    
    /**
     * 장비수정내역 엑셀 다운로드
     */
    @GetMapping("/excel")
    public ResponseEntity<byte[]> downloadExcel(@RequestParam(required = false) Long schoolId,
                                               @RequestParam(required = false) String searchType,
                                               @RequestParam(required = false) String searchKeyword,
                                               RedirectAttributes redirectAttributes) {
        
        log.info("장비수정내역 엑셀 다운로드 - schoolId: {}, searchType: {}, searchKeyword: {}", schoolId, searchType, searchKeyword);
        
        try {
            // 권한 체크 (학교별 권한 체크는 schoolId가 있을 때만)
            User user;
            if (schoolId != null) {
                user = checkSchoolPermission(Feature.DEVICE_LIST, schoolId, redirectAttributes);
            } else {
                user = checkPermission(Feature.DEVICE_LIST, redirectAttributes);
            }
            if (user == null) {
                log.warn("권한이 없는 사용자의 엑셀 다운로드 시도");
                return ResponseEntity.status(403).build();
            }
            
            // 학교가 선택되지 않은 경우
            if (schoolId == null) {
                return ResponseEntity.badRequest().build();
            }
            
            // 학교 정보 조회
            School school = schoolService.getSchoolById(schoolId).orElse(null);
            if (school == null) {
                return ResponseEntity.notFound().build();
            }
            
            // 수정내역 조회 (페이징 없이 전체)
            List<DeviceHistory> histories;
            if (searchType != null && !searchType.isEmpty() || 
                searchKeyword != null && !searchKeyword.trim().isEmpty()) {
                // 검색 조건이 있는 경우 - 전체 결과를 가져오기 위해 큰 페이지 사이즈 사용
                Page<DeviceHistory> historyPage = deviceHistoryService.getDeviceHistoryBySchoolAndSearch(
                    schoolId, searchType, searchKeyword, 1, 10000);
                histories = historyPage.getContent();
            } else {
                // 검색 조건이 없는 경우
                histories = deviceHistoryService.getAllDeviceHistoryBySchool(schoolId);
            }
            
            // 엑셀 파일 생성
            byte[] excelBytes = createExcelFile(histories, school.getSchoolName(), searchKeyword);
            
            // 파일명 생성 (영문만 사용)
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = String.format("Device_History_%s.xlsx", timestamp);
            
            // HTTP 헤더 설정
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.set("Content-Disposition", "attachment; filename=\"" + fileName + "\"");
            headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");
            
            log.info("장비수정내역 엑셀 다운로드 완료 - {}건", histories.size());
            
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(excelBytes);
                    
        } catch (Exception e) {
            log.error("장비수정내역 엑셀 다운로드 중 오류 발생", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // 권한 체크 메서드
    private User checkPermission(Feature feature, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            if (redirectAttributes != null) {
                redirectAttributes.addFlashAttribute("error", "로그인이 필요합니다.");
            }
            return null;
        }
        
        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            if (redirectAttributes != null) {
                redirectAttributes.addFlashAttribute("error", "사용자를 찾을 수 없습니다.");
            }
            return null;
        }
        
        return permissionHelper.checkFeaturePermission(user, feature, redirectAttributes);
    }
    
    // 학교 권한 체크 메서드
    private User checkSchoolPermission(Feature feature, Long schoolId, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            if (redirectAttributes != null) {
                redirectAttributes.addFlashAttribute("error", "로그인이 필요합니다.");
            }
            return null;
        }
        
        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            if (redirectAttributes != null) {
                redirectAttributes.addFlashAttribute("error", "사용자를 찾을 수 없습니다.");
            }
            return null;
        }
        
        return permissionHelper.checkSchoolPermission(user, feature, schoolId, redirectAttributes);
    }
    
    /**
     * 엑셀 파일 생성
     */
    private byte[] createExcelFile(List<DeviceHistory> histories, String schoolName, String searchKeyword) throws IOException {
        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("장비수정내역");
        
        // 스타일 생성
        CellStyle headerStyle = createHeaderStyle(workbook);
        CellStyle dataStyle = createDataStyle(workbook);
        
        int rowNum = 0;
        
        // 제목 행
        Row titleRow = sheet.createRow(rowNum++);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue("장비 수정내역");
        titleCell.setCellStyle(headerStyle);
        sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 8));
        
        // 학교명 행
        Row schoolRow = sheet.createRow(rowNum++);
        Cell schoolCell = schoolRow.createCell(0);
        schoolCell.setCellValue("학교: " + (schoolName != null ? schoolName : ""));
        schoolCell.setCellStyle(dataStyle);
        
        // 검색 키워드 행 (검색이 있는 경우)
        if (searchKeyword != null && !searchKeyword.trim().isEmpty()) {
            Row keywordRow = sheet.createRow(rowNum++);
            Cell keywordCell = keywordRow.createCell(0);
            keywordCell.setCellValue("검색 키워드: " + searchKeyword.trim());
            keywordCell.setCellStyle(dataStyle);
        }
        
        // 빈 행
        rowNum++;
        
        // 헤더 행
        Row headerRow = sheet.createRow(rowNum++);
        String[] headers = {"수정일시", "장비구분", "제조사", "모델명", "IP주소", "수정필드", "이전값", "변경값", "수정자"};
        
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }
        
        // 데이터 행
        for (DeviceHistory history : histories) {
            Row dataRow = sheet.createRow(rowNum++);
            
            // 수정일시
            Cell dateCell = dataRow.createCell(0);
            dateCell.setCellValue(history.getModifiedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            dateCell.setCellStyle(dataStyle);
            
            // 장비구분
            Cell typeCell = dataRow.createCell(1);
            String deviceType = "미지정";
            if (history.getDevice() != null && history.getDevice().getType() != null) {
                deviceType = history.getDevice().getType();
            }
            typeCell.setCellValue(deviceType);
            typeCell.setCellStyle(dataStyle);
            
            // 제조사
            Cell manufacturerCell = dataRow.createCell(2);
            String manufacturer = "미지정";
            if (history.getDevice() != null && history.getDevice().getManufacturer() != null) {
                manufacturer = history.getDevice().getManufacturer();
            }
            manufacturerCell.setCellValue(manufacturer);
            manufacturerCell.setCellStyle(dataStyle);
            
            // 모델명
            Cell modelCell = dataRow.createCell(3);
            String model = "미지정";
            if (history.getDevice() != null && history.getDevice().getModelName() != null) {
                model = history.getDevice().getModelName();
            }
            modelCell.setCellValue(model);
            modelCell.setCellStyle(dataStyle);
            
            // IP주소
            Cell ipCell = dataRow.createCell(4);
            String ipAddress = "미지정";
            if (history.getDevice() != null && history.getDevice().getIpAddress() != null) {
                ipAddress = history.getDevice().getIpAddress();
            }
            ipCell.setCellValue(ipAddress);
            ipCell.setCellStyle(dataStyle);
            
            // 수정필드 (한글 변환)
            Cell fieldCell = dataRow.createCell(5);
            fieldCell.setCellValue(deviceHistoryService.getFieldNameInKorean(history.getFieldName()));
            fieldCell.setCellStyle(dataStyle);
            
            // 이전값
            Cell beforeCell = dataRow.createCell(6);
            beforeCell.setCellValue(history.getBeforeValue() != null ? history.getBeforeValue() : "-");
            beforeCell.setCellStyle(dataStyle);
            
            // 변경값
            Cell afterCell = dataRow.createCell(7);
            afterCell.setCellValue(history.getAfterValue() != null ? history.getAfterValue() : "-");
            afterCell.setCellStyle(dataStyle);
            
            // 수정자
            Cell userCell = dataRow.createCell(8);
            String userName = "미지정";
            if (history.getModifiedBy() != null && history.getModifiedBy().getName() != null) {
                userName = history.getModifiedBy().getName();
            }
            userCell.setCellValue(userName);
            userCell.setCellStyle(dataStyle);
        }
        
        // 컬럼 너비 자동 조정
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
        
        // 바이트 배열로 변환
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        workbook.write(outputStream);
        workbook.close();
        
        return outputStream.toByteArray();
    }
    
    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 12);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        return style;
    }
    
    private CellStyle createDataStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        return style;
    }
}
