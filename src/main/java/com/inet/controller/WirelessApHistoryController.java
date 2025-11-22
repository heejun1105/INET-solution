package com.inet.controller;

import com.inet.entity.School;
import com.inet.entity.User;
import com.inet.entity.WirelessApHistory;
import com.inet.entity.Feature;
import com.inet.config.PermissionHelper;
import com.inet.service.SchoolService;
import com.inet.service.WirelessApHistoryService;
import com.inet.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
@RequestMapping("/wireless-ap/history")
public class WirelessApHistoryController {
    
    private static final Logger log = LoggerFactory.getLogger(WirelessApHistoryController.class);
    
    private final WirelessApHistoryService wirelessApHistoryService;
    private final SchoolService schoolService;
    private final PermissionHelper permissionHelper;
    private final UserService userService;
    
    public WirelessApHistoryController(WirelessApHistoryService wirelessApHistoryService, 
                                     SchoolService schoolService, 
                                     PermissionHelper permissionHelper,
                                     UserService userService) {
        this.wirelessApHistoryService = wirelessApHistoryService;
        this.schoolService = schoolService;
        this.permissionHelper = permissionHelper;
        this.userService = userService;
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
     * 무선AP 수정내역 목록 페이지
     */
    @GetMapping("/list")
    public String list(@RequestParam(required = false) Long schoolId,
                      @RequestParam(required = false) String keyword,
                      @RequestParam(defaultValue = "1") int page,
                      @RequestParam(defaultValue = "20") int size,
                      Model model,
                      RedirectAttributes redirectAttributes) {
        
        log.info("무선AP 수정내역 목록 조회 - schoolId: {}, keyword: {}, page: {}, size: {}", 
                schoolId, keyword, page, size);
        
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
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);
        
        // 학교 목록 조회
        List<School> schools = schoolService.getAllSchools();
        model.addAttribute("schools", schools);
        
        // 학교가 선택된 경우에만 수정내역 조회
        if (schoolId != null) {
            School selectedSchool = schoolService.getSchoolById(schoolId).orElse(null);
            if (selectedSchool != null) {
                model.addAttribute("selectedSchool", selectedSchool);
                model.addAttribute("selectedSchoolId", schoolId);
            }
            
            if (selectedSchool != null) {
                Page<WirelessApHistory> historyPage;
                
                if (keyword != null && !keyword.trim().isEmpty()) {
                    // 검색 조건이 있는 경우
                    historyPage = wirelessApHistoryService.searchWirelessApHistory(schoolId, keyword.trim(), page, size);
                    model.addAttribute("searchKeyword", keyword.trim());
                } else {
                    // 검색 조건이 없는 경우
                    historyPage = wirelessApHistoryService.getWirelessApHistoryBySchool(schoolId, page, size);
                }
                
                model.addAttribute("historyPage", historyPage);
                model.addAttribute("histories", historyPage.getContent());
                model.addAttribute("currentPage", page);
                model.addAttribute("totalPages", historyPage.getTotalPages());
                model.addAttribute("totalElements", historyPage.getTotalElements());
                model.addAttribute("pageSize", size);
                
                // 페이징 계산
                int startPage = Math.max(1, page - 2);
                int endPage = Math.min(historyPage.getTotalPages(), page + 2);
                model.addAttribute("startPage", startPage);
                model.addAttribute("endPage", endPage);
                
                log.info("무선AP 수정내역 조회 완료 - 총 {}건, 페이지 {}/{}", 
                        historyPage.getTotalElements(), page, historyPage.getTotalPages());
            }
        }
        
        return "wireless-ap/history";
    }
    
    /**
     * 무선AP 수정내역 엑셀 다운로드
     */
    @GetMapping("/excel")
    public ResponseEntity<byte[]> downloadExcel(@RequestParam(required = false) Long schoolId,
                                               @RequestParam(required = false) String keyword,
                                               RedirectAttributes redirectAttributes) {
        
        log.info("무선AP 수정내역 엑셀 다운로드 - schoolId: {}, keyword: {}", schoolId, keyword);
        
        try {
            // 권한 체크 (학교별 권한 체크는 schoolId가 있을 때만)
            User user;
            if (schoolId != null) {
                user = checkSchoolPermission(Feature.WIRELESS_AP_LIST, schoolId, redirectAttributes);
            } else {
                user = checkPermission(Feature.WIRELESS_AP_LIST, redirectAttributes);
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
            List<WirelessApHistory> histories;
            if (keyword != null && !keyword.trim().isEmpty()) {
                // 검색 조건이 있는 경우 - 전체 결과를 가져오기 위해 큰 페이지 사이즈 사용
                Page<WirelessApHistory> historyPage = wirelessApHistoryService.searchWirelessApHistory(schoolId, keyword.trim(), 1, 10000);
                histories = historyPage.getContent();
            } else {
                // 검색 조건이 없는 경우
                Page<WirelessApHistory> historyPage = wirelessApHistoryService.getWirelessApHistoryBySchool(schoolId, 1, 10000);
                histories = historyPage.getContent();
            }
            
            // 엑셀 파일 생성
            byte[] excelBytes = createExcelFile(histories, school.getSchoolName(), keyword);
            
            // 파일명 생성 (영문만 사용)
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = String.format("WirelessAP_History_%s.xlsx", timestamp);
            
            // HTTP 헤더 설정
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.set("Content-Disposition", "attachment; filename=\"" + fileName + "\"");
            headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");
            
            log.info("무선AP 수정내역 엑셀 다운로드 완료 - {}건", histories.size());
            
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(excelBytes);
                    
        } catch (Exception e) {
            log.error("무선AP 수정내역 엑셀 다운로드 중 오류 발생", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * 엑셀 파일 생성
     */
    private byte[] createExcelFile(List<WirelessApHistory> histories, String schoolName, String keyword) throws IOException {
        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("무선AP수정내역");
        
        // 스타일 생성
        CellStyle headerStyle = createHeaderStyle(workbook);
        CellStyle dataStyle = createDataStyle(workbook);
        
        int rowNum = 0;
        
        // 제목 행
        Row titleRow = sheet.createRow(rowNum++);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue((schoolName != null ? schoolName : "") + " 무선AP 수정목록");
        titleCell.setCellStyle(headerStyle);
        sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 6));
        
        // 검색 키워드 행 (검색이 있는 경우)
        if (keyword != null && !keyword.trim().isEmpty()) {
            Row keywordRow = sheet.createRow(rowNum++);
            Cell keywordCell = keywordRow.createCell(0);
            keywordCell.setCellValue("검색 키워드: " + keyword.trim());
            keywordCell.setCellStyle(dataStyle);
        }
        
        // 빈 행
        rowNum++;
        
        // 헤더 행
        Row headerRow = sheet.createRow(rowNum++);
        String[] headers = {"수정일시", "라벨번호", "위치", "수정필드", "이전값", "변경값", "수정자"};
        
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }
        
        // 데이터 행
        for (WirelessApHistory history : histories) {
            Row dataRow = sheet.createRow(rowNum++);
            
            // 수정일시
            Cell dateCell = dataRow.createCell(0);
            dateCell.setCellValue(history.getModifiedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            dateCell.setCellStyle(dataStyle);
            
            // 라벨번호
            Cell labelCell = dataRow.createCell(1);
            String labelNumber = "미지정";
            if (history.getWirelessAp() != null && history.getWirelessAp().getNewLabelNumber() != null) {
                labelNumber = history.getWirelessAp().getNewLabelNumber();
            }
            labelCell.setCellValue(labelNumber);
            labelCell.setCellStyle(dataStyle);
            
            // 위치 (학교명 + 교실명)
            Cell locationCell = dataRow.createCell(2);
            String location = "";
            if (history.getWirelessAp() != null && history.getWirelessAp().getSchool() != null) {
                location = history.getWirelessAp().getSchool().getSchoolName();
                if (history.getWirelessAp().getLocation() != null && history.getWirelessAp().getLocation().getRoomName() != null) {
                    location += " - " + history.getWirelessAp().getLocation().getRoomName();
                } else {
                    location += " - 미지정";
                }
            } else {
                location = "미지정";
            }
            locationCell.setCellValue(location);
            locationCell.setCellStyle(dataStyle);
            
            // 수정필드 (한글 변환)
            Cell fieldCell = dataRow.createCell(3);
            fieldCell.setCellValue(translateFieldName(history.getFieldName()));
            fieldCell.setCellStyle(dataStyle);
            
            // 이전값
            Cell beforeCell = dataRow.createCell(4);
            beforeCell.setCellValue(history.getBeforeValue() != null ? history.getBeforeValue() : "-");
            beforeCell.setCellStyle(dataStyle);
            
            // 변경값
            Cell afterCell = dataRow.createCell(5);
            afterCell.setCellValue(history.getAfterValue() != null ? history.getAfterValue() : "-");
            afterCell.setCellStyle(dataStyle);
            
            // 수정자
            Cell userCell = dataRow.createCell(6);
            String userName = "미지정";
            if (history.getModifiedBy() != null && history.getModifiedBy().getName() != null) {
                userName = history.getModifiedBy().getName();
            }
            userCell.setCellValue(userName);
            userCell.setCellStyle(dataStyle);
        }
        
        // 컬럼 너비 자동 조정 (데이터 값에 비례)
        for (int i = 0; i < headers.length; i++) {
            int maxLength = headers[i].length(); // 헤더 길이로 시작
            
            // 해당 컬럼의 모든 셀 값 확인하여 최대 길이 찾기
            for (int rowIdx = 0; rowIdx <= rowNum - 1; rowIdx++) {
                Row row = sheet.getRow(rowIdx);
                if (row != null) {
                    Cell cell = row.getCell(i);
                    if (cell != null) {
                        String cellValue = "";
                        switch (cell.getCellType()) {
                            case STRING:
                                cellValue = cell.getStringCellValue();
                                break;
                            case NUMERIC:
                                cellValue = String.valueOf(cell.getNumericCellValue());
                                break;
                            case BOOLEAN:
                                cellValue = String.valueOf(cell.getBooleanCellValue());
                                break;
                            case FORMULA:
                                cellValue = cell.getCellFormula();
                                break;
                        }
                        // 한글 문자는 영문보다 더 넓으므로 가중치 적용
                        int weightedLength = calculateWeightedLength(cellValue);
                        if (weightedLength > maxLength) {
                            maxLength = weightedLength;
                        }
                    }
                }
            }
            
            // 너비 계산: 한글 기준으로 더 넓게 설정
            int columnWidth = (int) (maxLength * 256 * 1.5) + 1000; // 여유 공간 추가
            if (columnWidth < 2500) {
                columnWidth = 2500; // 최소 너비
            }
            sheet.setColumnWidth(i, columnWidth);
        }
        
        // ByteArrayOutputStream에 쓰기
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        workbook.write(outputStream);
        workbook.close();
        
        return outputStream.toByteArray();
    }
    
    /**
     * 헤더 스타일 생성 (장비 수정목록과 동일한 스타일)
     */
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
    
    /**
     * 데이터 스타일 생성 (장비 수정목록과 동일한 스타일)
     */
    private CellStyle createDataStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        return style;
    }
    
    /**
     * 한글 문자를 고려한 가중치 길이 계산
     */
    private int calculateWeightedLength(String text) {
        if (text == null) {
            return 0;
        }
        int length = 0;
        for (char c : text.toCharArray()) {
            // 한글, 한자, 일본어 등은 2배 가중치
            if ((c >= 0xAC00 && c <= 0xD7A3) || // 한글
                (c >= 0x4E00 && c <= 0x9FFF) || // 한자
                (c >= 0x3040 && c <= 0x309F) || // 히라가나
                (c >= 0x30A0 && c <= 0x30FF)) { // 가타카나
                length += 2;
            } else {
                length += 1;
            }
        }
        return length;
    }
    
    /**
     * 필드명 한글 변환
     */
    private String translateFieldName(String fieldName) {
        if (fieldName == null) return "";
        
        switch (fieldName) {
            case "location": return "위치";
            case "classroomType": return "교실구분";
            case "newLabelNumber": return "라벨번호";
            case "apYear": return "도입년도";
            case "manufacturer": return "제조사";
            case "model": return "모델";
            case "macAddress": return "MAC 주소";
            case "prevLabelNumber": return "기존라벨번호";
            case "speed": return "속도";
            default: return fieldName;
        }
    }
}
