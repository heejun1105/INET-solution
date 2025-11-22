package com.inet.service;

import com.inet.entity.School;
import com.inet.entity.WirelessAp;
import com.inet.repository.WirelessApRepository;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class WirelessApExcelExportService {

    private static final String UNASSIGNED_CLASSROOM_TYPE = "미지정";

    private final WirelessApService wirelessApService;
    private final SchoolService schoolService;
    private final WirelessApRepository wirelessApRepository;
    private final WirelessApHistoryService wirelessApHistoryService;

    public WirelessApExcelExportService(
            WirelessApService wirelessApService,
            SchoolService schoolService,
            WirelessApRepository wirelessApRepository,
            WirelessApHistoryService wirelessApHistoryService
    ) {
        this.wirelessApService = wirelessApService;
        this.schoolService = schoolService;
        this.wirelessApRepository = wirelessApRepository;
        this.wirelessApHistoryService = wirelessApHistoryService;
    }

    public boolean hasWirelessAps(Long schoolId) {
        return wirelessApRepository.countBySchoolSchoolId(schoolId) > 0;
    }

    public Optional<byte[]> generateSchoolExcel(Long schoolId) {
        return generateSchoolExcel(schoolId, null);
    }

    public Optional<byte[]> generateSchoolExcel(Long schoolId, Long classroomId) {
        School school = schoolService.getSchoolById(schoolId)
                .orElseThrow(() -> new IllegalArgumentException("학교를 찾을 수 없습니다. (ID: " + schoolId + ")"));

        List<WirelessAp> wirelessAps = classroomId == null
                ? wirelessApService.getWirelessApsBySchool(school)
                : filterByClassroomId(wirelessApService.getWirelessApsBySchool(school), classroomId);

        if (wirelessAps.isEmpty()) {
            return Optional.empty();
        }
        
        // 페이지 다운로드와 동일한 순서로 정렬 (컨트롤러의 정렬 로직 확인 필요)
        // 컨트롤러에서는 정렬이 없으므로 그대로 유지

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            createSummarySheet(workbook, wirelessAps);
            createDetailSheet(workbook, wirelessAps);
            workbook.write(outputStream);
            return Optional.of(outputStream.toByteArray());
        } catch (IOException e) {
            throw new IllegalStateException("무선 AP 엑셀 파일 생성 중 오류가 발생했습니다.", e);
        }
    }

    private List<WirelessAp> filterByClassroomId(List<WirelessAp> wirelessAps, Long classroomId) {
        List<WirelessAp> filtered = new ArrayList<>();
        for (WirelessAp ap : wirelessAps) {
            if (ap.getLocation() != null && classroomId.equals(ap.getLocation().getClassroomId())) {
                filtered.add(ap);
            }
        }
        return filtered;
    }

    private void createSummarySheet(Workbook workbook, List<WirelessAp> wirelessAps) {
        Sheet summarySheet = workbook.createSheet("총괄표");

        CellStyle headerStyle = createHeaderStyle(workbook);
        CellStyle dataStyle = createDataStyle(workbook);

        String schoolName = getSchoolName(wirelessAps);
        Row titleRow = summarySheet.createRow(0);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue(schoolName + " 무선 AP 현황");
        titleCell.setCellStyle(headerStyle);
        summarySheet.addMergedRegion(org.apache.poi.ss.util.CellRangeAddress.valueOf("A1:G1"));

        // AP 정보의 마지막 수정일자 조회 (모든 AP 중 가장 최근 수정일자)
        java.time.LocalDateTime lastModifiedDateTime = null;
        for (WirelessAp ap : wirelessAps) {
            Optional<java.time.LocalDateTime> lastModified = wirelessApHistoryService.getLastModifiedDate(ap);
            if (lastModified.isPresent()) {
                if (lastModifiedDateTime == null || lastModified.get().isAfter(lastModifiedDateTime)) {
                    lastModifiedDateTime = lastModified.get();
                }
            }
        }
        
        // 작성일자: 마지막 수정일자가 있으면 그것을 사용, 없으면 현재 날짜
        String dateStr;
        if (lastModifiedDateTime != null) {
            dateStr = lastModifiedDateTime.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        } else {
            dateStr = java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        }
        
        // 작성일자 스타일 생성 (배경색 없음)
        CellStyle dateStyle = workbook.createCellStyle();
        dateStyle.setAlignment(HorizontalAlignment.RIGHT);
        Font dateFont = workbook.createFont();
        dateFont.setBold(true);
        dateStyle.setFont(dateFont);
        // 배경색 제거 (기본 스타일 유지)
        
        // 두번째 행: 작성일자 (오른쪽 끝에 배치)
        int lastCol = 6; // G열 (총괄표의 마지막 컬럼)
        Row dateRow = summarySheet.createRow(1);
        Cell dateLabelCell = dateRow.createCell(lastCol - 1); // 마지막 컬럼에서 두 번째
        dateLabelCell.setCellValue("작성일자");
        dateLabelCell.setCellStyle(dateStyle);
        
        Cell dateValueCell = dateRow.createCell(lastCol); // 마지막 컬럼
        dateValueCell.setCellValue(dateStr);
        dateValueCell.setCellStyle(dateStyle);

        Map<String, Map<String, Map<String, Map<String, Integer>>>> groupedData = new LinkedHashMap<>();
        Set<String> allClassroomTypes = new HashSet<>();

        for (WirelessAp ap : wirelessAps) {
            String year = ap.getAPYear() != null ? ap.getAPYear().getYear() + "년" : "";
            String manufacturer = ap.getManufacturer() != null ? ap.getManufacturer() : "";
            String model = ap.getModel() != null ? ap.getModel() : "";
            String classroomType = ap.getClassroomType() != null ? ap.getClassroomType().trim() : "";
            if (classroomType.isEmpty()) {
                classroomType = UNASSIGNED_CLASSROOM_TYPE;
            }

            allClassroomTypes.add(classroomType);

            groupedData.computeIfAbsent(year, k -> new LinkedHashMap<>())
                    .computeIfAbsent(manufacturer, k -> new LinkedHashMap<>())
                    .computeIfAbsent(model, k -> new LinkedHashMap<>())
                    .merge(classroomType, 1, Integer::sum);
        }

        List<String> sortedClassroomTypes = allClassroomTypes.stream()
                .sorted(this::compareClassroomTypes)
                .toList();

        List<String> sortedYears = groupedData.keySet().stream()
                .filter(year -> !year.isEmpty())
                .sorted(this::compareYears)
                .toList();

        Row headerRow = summarySheet.createRow(3);
        List<String> headers = new ArrayList<>();
        headers.add("도입년도");
        headers.add("제조사");
        headers.add("모델명");
        headers.add("수량합계");
        headers.addAll(sortedClassroomTypes);

        for (int i = 0; i < headers.size(); i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers.get(i));
            cell.setCellStyle(headerStyle);
            summarySheet.setColumnWidth(i, 4000);
        }

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

                    int total = classroomCounts.values().stream().mapToInt(Integer::intValue).sum();
                    row.createCell(3).setCellValue(total);

                    for (int i = 0; i < sortedClassroomTypes.size(); i++) {
                        String classroomType = sortedClassroomTypes.get(i);
                        int count = classroomCounts.getOrDefault(classroomType, 0);
                        row.createCell(4 + i).setCellValue(count);
                        totalByClassroomType.merge(classroomType, count, Integer::sum);
                    }

                    for (int i = 0; i < headers.size(); i++) {
                        row.getCell(i).setCellStyle(dataStyle);
                    }
                }
            }
        }

        Row totalRow = summarySheet.createRow(rowNum);
        totalRow.createCell(0).setCellValue("총계");
        totalRow.createCell(1).setCellValue("");
        totalRow.createCell(2).setCellValue("");

        int grandTotal = totalByClassroomType.values().stream().mapToInt(Integer::intValue).sum();
        totalRow.createCell(3).setCellValue(grandTotal);

        for (int i = 0; i < sortedClassroomTypes.size(); i++) {
            String classroomType = sortedClassroomTypes.get(i);
            int total = totalByClassroomType.getOrDefault(classroomType, 0);
            totalRow.createCell(4 + i).setCellValue(total);
        }

        for (int i = 0; i < headers.size(); i++) {
            totalRow.getCell(i).setCellStyle(dataStyle);
        }
    }

    private void createDetailSheet(Workbook workbook, List<WirelessAp> wirelessAps) {
        Sheet sheet = workbook.createSheet("무선AP 목록");

        CellStyle headerStyle = createHeaderStyle(workbook);
        CellStyle dataStyle = createDataStyle(workbook);

        String schoolName = getSchoolName(wirelessAps);
        Row titleRow = sheet.createRow(0);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue(schoolName + " 무선 AP 현황");
        titleCell.setCellStyle(headerStyle);
        sheet.addMergedRegion(org.apache.poi.ss.util.CellRangeAddress.valueOf("A1:K1"));

        // AP 정보의 마지막 수정일자 조회 (모든 AP 중 가장 최근 수정일자)
        java.time.LocalDateTime lastModifiedDateTime = null;
        for (WirelessAp ap : wirelessAps) {
            Optional<java.time.LocalDateTime> lastModified = wirelessApHistoryService.getLastModifiedDate(ap);
            if (lastModified.isPresent()) {
                if (lastModifiedDateTime == null || lastModified.get().isAfter(lastModifiedDateTime)) {
                    lastModifiedDateTime = lastModified.get();
                }
            }
        }
        
        // 작성일자: 마지막 수정일자가 있으면 그것을 사용, 없으면 현재 날짜
        String dateStr;
        if (lastModifiedDateTime != null) {
            dateStr = lastModifiedDateTime.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        } else {
            dateStr = java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        }

        // 작성일자 스타일 생성 (배경색 없음)
        CellStyle dateStyle = workbook.createCellStyle();
        dateStyle.setAlignment(HorizontalAlignment.RIGHT);
        Font dateFont = workbook.createFont();
        dateFont.setBold(true);
        dateStyle.setFont(dateFont);
        // 배경색 제거 (기본 스타일 유지)
        
        // 두번째 행: 작성일자 (오른쪽 끝에 배치)
        int lastCol = 10; // K열 (무선AP 목록의 마지막 컬럼)
        Row dateRow = sheet.createRow(1);
        Cell dateLabelCell = dateRow.createCell(lastCol - 1); // 마지막 컬럼에서 두 번째
        dateLabelCell.setCellValue("작성일자");
        dateLabelCell.setCellStyle(dateStyle);
        
        Cell dateValueCell = dateRow.createCell(lastCol); // 마지막 컬럼
        dateValueCell.setCellValue(dateStr);
        dateValueCell.setCellStyle(dateStyle);

        String[] headers = {
                "신규라벨번호", "기기번호", "설치장소", "교실유형", "제조사", "모델명",
                "도입연도", "속도", "MAC 주소", "이전 설치장소", "이전 라벨번호"
        };

        Row headerRow = sheet.createRow(2);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
            sheet.setColumnWidth(i, 4000);
        }

        int rowNum = 4;
        for (WirelessAp ap : wirelessAps) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(orEmpty(ap.getNewLabelNumber()));
            row.createCell(1).setCellValue(orEmpty(ap.getDeviceNumber()));
            row.createCell(2).setCellValue(ap.getLocation() != null ? orEmpty(ap.getLocation().getRoomName()) : "");
            row.createCell(3).setCellValue(orEmpty(ap.getClassroomType()));
            row.createCell(4).setCellValue(orEmpty(ap.getManufacturer()));
            row.createCell(5).setCellValue(orEmpty(ap.getModel()));
            row.createCell(6).setCellValue(ap.getAPYear() != null ? ap.getAPYear().getYear() + "년" : "");
            row.createCell(7).setCellValue(orEmpty(ap.getSpeed()));
            row.createCell(8).setCellValue(orEmpty(ap.getMacAddress()));
            row.createCell(9).setCellValue(orEmpty(ap.getPrevLocation()));
            row.createCell(10).setCellValue(orEmpty(ap.getPrevLabelNumber()));

            for (int i = 0; i < headers.length; i++) {
                row.getCell(i).setCellStyle(dataStyle);
            }
        }
    }

    private String getSchoolName(List<WirelessAp> wirelessAps) {
        if (!wirelessAps.isEmpty() && wirelessAps.get(0).getSchool() != null) {
            return wirelessAps.get(0).getSchool().getSchoolName();
        }
        return "";
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
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
        return headerStyle;
    }

    private CellStyle createDataStyle(Workbook workbook) {
        CellStyle dataStyle = workbook.createCellStyle();
        dataStyle.setAlignment(HorizontalAlignment.CENTER);
        dataStyle.setVerticalAlignment(VerticalAlignment.CENTER);
        dataStyle.setBorderTop(BorderStyle.THIN);
        dataStyle.setBorderBottom(BorderStyle.THIN);
        dataStyle.setBorderLeft(BorderStyle.THIN);
        dataStyle.setBorderRight(BorderStyle.THIN);
        return dataStyle;
    }

    private int compareClassroomTypes(String t1, String t2) {
        try {
            int num1 = Integer.parseInt(t1);
            int num2 = Integer.parseInt(t2);
            return Integer.compare(num1, num2);
        } catch (NumberFormatException e) {
            return t1.compareTo(t2);
        }
    }

    private int compareYears(String y1, String y2) {
        int year1 = Integer.parseInt(y1.replace("년", ""));
        int year2 = Integer.parseInt(y2.replace("년", ""));
        return Integer.compare(year1, year2);
    }

    private String orEmpty(String value) {
        return value != null ? value : "";
    }
}

