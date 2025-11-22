package com.inet.service;

import com.inet.entity.Device;
import com.inet.entity.Manage;
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
import org.apache.poi.ss.util.CellRangeAddress;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
public class IpExcelExportService {

    private final DeviceService deviceService;
    private final SchoolService schoolService;
    private final DeviceHistoryService deviceHistoryService;

    public IpExcelExportService(
            DeviceService deviceService,
            SchoolService schoolService,
            DeviceHistoryService deviceHistoryService
    ) {
        this.deviceService = deviceService;
        this.schoolService = schoolService;
        this.deviceHistoryService = deviceHistoryService;
    }

    public boolean hasDevicesWithIp(Long schoolId) {
        return deviceService.findBySchool(schoolId).stream()
                .anyMatch(device -> isValidIpAddress(device.getIpAddress()));
    }

    public Optional<byte[]> generateExcel(Long schoolId, String secondOctet) {
        schoolService.getSchoolById(schoolId)
                .orElseThrow(() -> new IllegalArgumentException("학교를 찾을 수 없습니다. (ID: " + schoolId + ")"));

        List<Device> devices = deviceService.findBySchool(schoolId).stream()
                .filter(device -> isValidIpAddress(device.getIpAddress()))
                .collect(Collectors.toList());

        if (devices.isEmpty()) {
            return Optional.empty();
        }

        Map<String, List<Device>> devicesByOctet = devices.stream()
                .collect(Collectors.groupingBy(device -> device.getIpAddress().split("\\.")[1]));

        // 학교 전체의 IP 수정일자 조회 (모든 시트에 동일한 시간 표시)
        java.time.LocalDateTime lastIpModifiedDateTime = null;
        for (Device device : devices) {
            Optional<java.time.LocalDateTime> lastIpModified = deviceHistoryService.getLastIpAddressModifiedDate(device);
            if (lastIpModified.isPresent()) {
                if (lastIpModifiedDateTime == null || lastIpModified.get().isAfter(lastIpModifiedDateTime)) {
                    lastIpModifiedDateTime = lastIpModified.get();
                }
            }
        }
        
        // 작성일자: IP 수정일자가 있으면 그것을 사용, 없으면 현재 날짜
        String dateStr;
        if (lastIpModifiedDateTime != null) {
            dateStr = lastIpModifiedDateTime.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        } else {
            dateStr = java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        }

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle titleStyle = createTitleStyle(workbook, headerStyle);
            CellStyle dataStyle = createDataStyle(workbook);
            CellStyle warningStyle = createWarningStyle(workbook, dataStyle);
            CellStyle sectionHeaderStyle = createSectionHeaderStyle(workbook);

            if ("all".equalsIgnoreCase(secondOctet)) {
                createCombinedSheet(workbook, devicesByOctet, dateStr, titleStyle, headerStyle, dataStyle, warningStyle, sectionHeaderStyle);
            } else if (secondOctet != null && !secondOctet.isEmpty()) {
                List<Device> specificDevices = devicesByOctet.getOrDefault(secondOctet, new ArrayList<>());
                if (specificDevices.isEmpty()) {
                    return Optional.empty();
                }
                createSheet(workbook, secondOctet, specificDevices, dateStr, titleStyle, headerStyle, dataStyle, warningStyle);
            } else {
                devicesByOctet.keySet().stream()
                        .sorted(Comparator.comparingInt(Integer::parseInt))
                        .forEach(octet -> createSheet(workbook, octet, devicesByOctet.get(octet), dateStr, titleStyle, headerStyle, dataStyle, warningStyle));
            }

            workbook.write(outputStream);
            return Optional.of(outputStream.toByteArray());
        } catch (IOException e) {
            throw new IllegalStateException("IP 대장 엑셀 파일 생성 중 오류가 발생했습니다.", e);
        }
    }

    private void createCombinedSheet(Workbook workbook, Map<String, List<Device>> devicesByOctet,
                                     String dateStr,
                                     CellStyle titleStyle, CellStyle headerStyle,
                                     CellStyle dataStyle, CellStyle warningStyle,
                                     CellStyle sectionHeaderStyle) {
        Sheet sheet = workbook.createSheet("전체");

        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(40);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue("IP대장업무용(전체 IP 대역)");
        titleCell.setCellStyle(titleStyle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 15));

        // 작성일자 스타일 생성 (배경색 없음)
        CellStyle dateStyle = workbook.createCellStyle();
        dateStyle.setAlignment(HorizontalAlignment.RIGHT);
        Font dateFont = workbook.createFont();
        dateFont.setBold(true);
        dateStyle.setFont(dateFont);
        // 배경색 제거 (기본 스타일 유지)
        
        // 두번째 행: 작성일자 (오른쪽 끝에 배치)
        int lastCol = 15; // 마지막 컬럼
        Row dateRow = sheet.createRow(1);
        dateRow.setHeightInPoints(25);
        Cell dateLabelCell = dateRow.createCell(lastCol - 1); // 마지막 컬럼에서 두 번째
        dateLabelCell.setCellValue("작성일자");
        dateLabelCell.setCellStyle(dateStyle);
        
        Cell dateValueCell = dateRow.createCell(lastCol); // 마지막 컬럼
        dateValueCell.setCellValue(dateStr);
        dateValueCell.setCellStyle(dateStyle);

        String[] headers = {"IP", "관리번호", "모델명", "설치장소"};
        Row headerRow = sheet.createRow(2);
        headerRow.setHeightInPoints(25);
        for (int i = 0; i < 4; i++) {
            for (int j = 0; j < headers.length; j++) {
                Cell cell = headerRow.createCell(i * 4 + j);
                cell.setCellValue(headers[j]);
                cell.setCellStyle(headerStyle);
            }
        }

        int currentRow = 3;
        List<String> sortedOctets = devicesByOctet.keySet().stream()
                .sorted(Comparator.comparingInt(Integer::parseInt))
                .toList();

        for (String octet : sortedOctets) {
            Row sectionRow = sheet.createRow(currentRow++);
            sectionRow.setHeightInPoints(25);
            Cell sectionCell = sectionRow.createCell(0);
            sectionCell.setCellValue("IP 대역: 10." + octet + ".36.x");
            sectionCell.setCellStyle(sectionHeaderStyle);
            sheet.addMergedRegion(new CellRangeAddress(currentRow - 1, currentRow - 1, 0, 15));

            Map<Integer, Device> deviceMap = devicesByOctet.get(octet).stream()
                    .collect(Collectors.toMap(
                            d -> Integer.parseInt(d.getIpAddress().split("\\.")[3]),
                            d -> d,
                            (existing, replacement) -> existing
                    ));

            int rowsPerGroup = 64;
            for (int i = 0; i < rowsPerGroup; i++) {
                Row dataRow = sheet.createRow(currentRow++);
                dataRow.setHeightInPoints(20);

                for (int group = 0; group < 4; group++) {
                    int ipNumber = i + 1 + (group * rowsPerGroup);
                    if (ipNumber > 254) {
                        continue;
                    }
                    int baseCol = group * 4;
                    Device device = deviceMap.get(ipNumber);
                    CellStyle style = (ipNumber >= 245 && ipNumber <= 254) ? warningStyle : dataStyle;

                    Cell ipCell = dataRow.createCell(baseCol);
                    ipCell.setCellValue(ipNumber);
                    ipCell.setCellStyle(style);

                    populateDetailCells(baseCol, dataRow, style, device);
                }
            }

            sheet.createRow(currentRow++);
        }

        adjustColumnWidths(sheet);
    }

    private void createSheet(Workbook workbook, String secondOctet, List<Device> devices,
                             String dateStr,
                             CellStyle titleStyle, CellStyle headerStyle,
                             CellStyle dataStyle, CellStyle warningStyle) {
        Sheet sheet = workbook.createSheet(secondOctet);

        Map<Integer, Device> deviceMap = devices.stream()
                .collect(Collectors.toMap(
                        d -> Integer.parseInt(d.getIpAddress().split("\\.")[3]),
                        d -> d,
                        (existing, replacement) -> existing
                ));

        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(40);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue(String.format("IP대장업무용(10.%s.36.001-254)", secondOctet));
        titleCell.setCellStyle(titleStyle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 15));

        // 작성일자 스타일 생성 (배경색 없음)
        CellStyle dateStyle = workbook.createCellStyle();
        dateStyle.setAlignment(HorizontalAlignment.RIGHT);
        Font dateFont = workbook.createFont();
        dateFont.setBold(true);
        dateStyle.setFont(dateFont);
        // 배경색 제거 (기본 스타일 유지)
        
        // 두번째 행: 작성일자 (오른쪽 끝에 배치)
        int lastCol = 15; // 마지막 컬럼
        Row dateRow = sheet.createRow(1);
        dateRow.setHeightInPoints(25);
        Cell dateLabelCell = dateRow.createCell(lastCol - 1); // 마지막 컬럼에서 두 번째
        dateLabelCell.setCellValue("작성일자");
        dateLabelCell.setCellStyle(dateStyle);
        
        Cell dateValueCell = dateRow.createCell(lastCol); // 마지막 컬럼
        dateValueCell.setCellValue(dateStr);
        dateValueCell.setCellStyle(dateStyle);

        String[] headers = {"IP", "관리번호", "모델명", "설치장소"};
        Row headerRow = sheet.createRow(2);
        headerRow.setHeightInPoints(25);
        for (int i = 0; i < 4; i++) {
            for (int j = 0; j < headers.length; j++) {
                Cell cell = headerRow.createCell(i * 4 + j);
                cell.setCellValue(headers[j]);
                cell.setCellStyle(headerStyle);
            }
        }

        int rowsPerGroup = 64;
        for (int i = 0; i < rowsPerGroup; i++) {
            Row dataRow = sheet.createRow(i + 3);
            dataRow.setHeightInPoints(20);

            for (int group = 0; group < 4; group++) {
                int ipNumber = i + 1 + (group * rowsPerGroup);
                if (ipNumber > 254) {
                    continue;
                }

                int baseCol = group * 4;
                Device device = deviceMap.get(ipNumber);
                CellStyle style = (ipNumber >= 245 && ipNumber <= 254) ? warningStyle : dataStyle;

                Cell ipCell = dataRow.createCell(baseCol);
                ipCell.setCellValue(ipNumber);
                ipCell.setCellStyle(style);

                    populateDetailCells(baseCol, dataRow, style, device);
            }
        }

        adjustColumnWidths(sheet);
    }

    private void adjustColumnWidths(Sheet sheet) {
        sheet.setColumnWidth(0, 2500);
        sheet.setColumnWidth(1, 3500);
        sheet.setColumnWidth(2, 5000);
        sheet.setColumnWidth(3, 4500);
        for (int i = 1; i < 4; i++) {
            sheet.setColumnWidth(i * 4, 2500);
            sheet.setColumnWidth(i * 4 + 1, 3500);
            sheet.setColumnWidth(i * 4 + 2, 5000);
            sheet.setColumnWidth(i * 4 + 3, 4500);
        }
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        return style;
    }

    private CellStyle createTitleStyle(Workbook workbook, CellStyle baseStyle) {
        CellStyle style = workbook.createCellStyle();
        style.cloneStyleFrom(baseStyle);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        return style;
    }

    private CellStyle createDataStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private CellStyle createWarningStyle(Workbook workbook, CellStyle baseStyle) {
        CellStyle style = workbook.createCellStyle();
        style.cloneStyleFrom(baseStyle);
        style.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private CellStyle createSectionHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        return style;
    }

    private boolean isValidIpAddress(String ipAddress) {
        if (ipAddress == null || ipAddress.isBlank()) {
            return false;
        }
        String[] parts = ipAddress.split("\\.");
        if (parts.length != 4) {
            return false;
        }
        return IntStream.range(0, 4)
                .allMatch(i -> {
                    try {
                        int part = Integer.parseInt(parts[i]);
                        return part >= 0 && part <= 255;
                    } catch (NumberFormatException e) {
                        return false;
                    }
                });
    }

    private void populateDetailCells(int baseCol, Row dataRow, CellStyle style, Device device) {
        for (int j = 1; j < 4; j++) {
            Cell cell = dataRow.createCell(baseCol + j);
            cell.setCellStyle(style);

            if (device == null) {
                continue;
            }

            switch (j) {
                case 1 -> {
                    String manageNumber = buildManageNumber(device);
                    if (manageNumber != null && !manageNumber.isBlank()) {
                        cell.setCellValue(manageNumber);
                    }
                }
                case 2 -> {
                    String modelName = device.getModelName();
                    if (modelName != null && !modelName.trim().isEmpty()) {
                        cell.setCellValue(modelName.trim());
                    }
                }
                case 3 -> {
                    if (device.getClassroom() != null
                            && device.getClassroom().getRoomName() != null
                            && !device.getClassroom().getRoomName().trim().isEmpty()) {
                        cell.setCellValue(device.getClassroom().getRoomName().trim());
                    }
                }
                default -> {
                }
            }
        }
    }

    private String buildManageNumber(Device device) {
        Manage manage = device.getManage();
        if (manage == null || manage.getManageCate() == null) {
            return null;
        }

        StringBuilder builder = new StringBuilder(manage.getManageCate());
        if (manage.getYear() != null) {
            builder.append("-").append(manage.getYear()).append("-");
        } else {
            builder.append("-");
        }
        if (manage.getManageNum() != null) {
            builder.append(String.format("%02d", manage.getManageNum()));
        }
        return builder.toString();
    }
}

