package com.inet.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.inet.entity.Device;
import com.inet.entity.School;
import com.inet.entity.Uid;
import com.inet.repository.DeviceRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class QrCodeService {
    
    @Autowired
    private UidService uidService;
    
    @Autowired
    private SchoolService schoolService;

    @Autowired
    private DeviceRepository deviceRepository;
    
    @Autowired
    private DeviceService deviceService;

    private static final List<String> DEFAULT_INFO_LINES = List.of("MANAGE", "MANUFACTURER", "MODEL", "UID");
    private static final DateTimeFormatter PURCHASE_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy.MM");
    
    /**
     * QR 코드 이미지를 생성합니다.
     * @param content QR 코드에 인코딩할 내용
     * @param size QR 코드 크기 (픽셀)
     * @return QR 코드 이미지의 바이트 배열
     */
    public byte[] generateQrCode(String content, int size) throws WriterException, IOException {
        Map<EncodeHintType, Object> hints = new HashMap<>();
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.H);
        hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
        hints.put(EncodeHintType.MARGIN, 1);
        
        QRCodeWriter qrCodeWriter = new QRCodeWriter();
        BitMatrix bitMatrix = qrCodeWriter.encode(content, BarcodeFormat.QR_CODE, size, size, hints);
        
        BufferedImage image = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);
        for (int x = 0; x < size; x++) {
            for (int y = 0; y < size; y++) {
                image.setRGB(x, y, bitMatrix.get(x, y) ? 0xFF000000 : 0xFFFFFFFF);
            }
        }
        
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(image, "PNG", baos);
        return baos.toByteArray();
    }
    
    /**
     * 학교의 모든 고유번호를 포함한 엑셀 파일을 생성합니다.
     * @param schoolId 학교 ID
     * @return 엑셀 파일의 바이트 배열
     */
    public byte[] generateQrCodeExcel(Long schoolId, List<String> infoFields) throws IOException, WriterException {
        School school = schoolService.findById(schoolId)
                .orElseThrow(() -> new RuntimeException("학교를 찾을 수 없습니다."));
        
        List<Uid> uids = uidService.getUidsBySchoolId(schoolId);
        List<String> fieldConfig = normalizeInfoFields(infoFields);
        return generateQrCodeExcelWithUids(school, uids, fieldConfig);
    }
    
    /**
     * 필터링된 장비들의 고유번호를 포함한 엑셀 파일을 생성합니다.
     * @param schoolId 학교 ID
     * @param type 장비 유형 (선택사항)
     * @param classroomId 교실 ID (선택사항)
     * @param searchKeyword 검색 키워드 (선택사항)
     * @param infoFields 정보 필드 목록
     * @return 엑셀 파일의 바이트 배열
     */
    public byte[] generateQrCodeExcelFiltered(Long schoolId, String type, Long classroomId, String searchKeyword, List<String> infoFields) throws IOException, WriterException {
        School school = schoolService.findById(schoolId)
                .orElseThrow(() -> new RuntimeException("학교를 찾을 수 없습니다."));
        
        // 필터링된 장비 목록 가져오기
        List<Device> filteredDevices;
        if (searchKeyword != null && !searchKeyword.trim().isEmpty()) {
            filteredDevices = deviceService.searchDevices(schoolId, type, classroomId, searchKeyword);
        } else {
            filteredDevices = deviceService.findFiltered(schoolId, type, classroomId);
        }
        
        // 장비들의 Uid 추출
        List<Uid> uids = filteredDevices.stream()
                .filter(device -> device.getUid() != null)
                .map(Device::getUid)
                .distinct()
                .collect(Collectors.toList());
        
        List<String> fieldConfig = normalizeInfoFields(infoFields);
        return generateQrCodeExcelWithUids(school, uids, fieldConfig);
    }
    
    /**
     * Uid 리스트를 받아서 QR 코드 엑셀 파일을 생성합니다.
     * @param school 학교 객체
     * @param uids Uid 리스트
     * @param fieldConfig 필드 설정
     * @return 엑셀 파일의 바이트 배열
     */
    private byte[] generateQrCodeExcelWithUids(School school, List<Uid> uids, List<String> fieldConfig) throws IOException, WriterException {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("QR코드");
            
            CellStyle titleStyle = createTitleStyle(workbook);
            CellStyle qrBoxStyle = createUidStyle(workbook);
            CellStyle infoStyle = createInfoStyle(workbook);

            final int blocksPerRow = 2;
            final int qrColSpan = 4;
            final int textColSpan = 6;
            final int blockWidth = qrColSpan + textColSpan;
            final int textRows = fieldConfig.size();
            final int dataStartRow = 2;
            final int rowSpacing = 2;
            final int totalColumns = blocksPerRow * blockWidth;

            // 열 너비 설정
        final int qrColumnWidth = 1600;
        final int infoColumnWidth = 2800;

        for (int col = 0; col < totalColumns; col++) {
            boolean isQrColumn = (col % blockWidth) < qrColSpan;
            sheet.setColumnWidth(col, isQrColumn ? qrColumnWidth : infoColumnWidth);
        }

            // 제목 행
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(20f);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue(school.getSchoolName());
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, Math.max(totalColumns - 1, 0)));

            CreationHelper helper = workbook.getCreationHelper();
            Drawing<?> drawing = sheet.createDrawingPatriarch();

            for (int index = 0; index < uids.size(); index++) {
                Uid uid = uids.get(index);
                Device device = deviceRepository.findByUid(uid).orElse(null);

                int blockRowIndex = index / blocksPerRow;
                int blockColIndex = index % blocksPerRow;
                int startRow = dataStartRow + blockRowIndex * (textRows + rowSpacing);
                int startCol = blockColIndex * blockWidth;
            
                for (int r = 0; r < textRows; r++) {
                int rowIndex = startRow + r;
                Row row = sheet.getRow(rowIndex);
                if (row == null) {
                    row = sheet.createRow(rowIndex);
                }
                row.setHeightInPoints(25.5f);

                    for (int c = 0; c < qrColSpan; c++) {
                        Cell cell = row.getCell(startCol + c);
                        if (cell == null) {
                            cell = row.createCell(startCol + c);
                        }
                        cell.setCellStyle(qrBoxStyle);
                    }

                    for (int c = qrColSpan; c < blockWidth; c++) {
                        Cell cell = row.getCell(startCol + c);
                        if (cell == null) {
                            cell = row.createCell(startCol + c);
                        }
                        cell.setCellStyle(infoStyle);
                    }
                }

                sheet.addMergedRegion(new CellRangeAddress(startRow, startRow + textRows - 1, startCol, startCol + qrColSpan - 1));

                List<String> infoLines = buildInfoLines(fieldConfig, uid, device, true); // QR 코드 다운로드: 라벨 포함
                for (int r = 0; r < textRows; r++) {
                    int rowIndex = startRow + r;
                    int firstCol = startCol + qrColSpan;
                    int lastCol = startCol + blockWidth - 1;
                    sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, firstCol, lastCol));
                    Cell infoCell = sheet.getRow(rowIndex).getCell(firstCol);
                    infoCell.setCellValue(infoLines.get(r));
                }

                String qrContent = uid.getDisplayUid();
                if (qrContent == null || qrContent.isBlank()) {
                    qrContent = uid.getDisplayId();
                }

                if (qrContent != null && !qrContent.isBlank()) {
                    int qrPixels = (int) Math.round((3.6 / 2.54) * 96);
                    byte[] qrCodeBytes = generateQrCode(qrContent, qrPixels);
                    int pictureIndex = workbook.addPicture(qrCodeBytes, Workbook.PICTURE_TYPE_PNG);
                    
                    ClientAnchor anchor = helper.createClientAnchor();
                    anchor.setCol1(startCol);
                    anchor.setRow1(startRow);
                    anchor.setCol2(startCol + qrColSpan);
                    anchor.setRow2(startRow + textRows);
                    Picture pict = drawing.createPicture(anchor, pictureIndex);
                    if (pict != null) {
                        pict.resize(1.0);
                    }
                }
            }
            
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            workbook.write(baos);
            return baos.toByteArray();
        }
    }
    
    /**
     * 헤더 스타일을 생성합니다.
     */
    /**
     * 제목 스타일을 생성합니다.
     */
    private CellStyle createTitleStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 14);
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        return style;
    }
    
    /**
     * 고유번호 스타일을 생성합니다.
     */
    private CellStyle createUidStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setFontHeightInPoints((short) 8); // 10에서 8로 축소하여 글자 짤림 방지
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }
    
    private CellStyle createInfoStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setFontHeightInPoints((short) 9);
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setIndention((short) 1);
        style.setWrapText(false);
        return style;
    }

    private List<String> normalizeInfoFields(List<String> infoFields) {
        List<String> normalized = new ArrayList<>(DEFAULT_INFO_LINES);
        if (infoFields != null) {
            for (int i = 0; i < Math.min(infoFields.size(), normalized.size()); i++) {
                normalized.set(i, normalizeField(infoFields.get(i)));
            }
        }
        return normalized;
    }

    private String normalizeField(String field) {
        if (field == null) {
            return "NONE";
        }
        String normalized = field.trim().toUpperCase();
        switch (normalized) {
            case "MANAGE":
            case "MANUFACTURER":
            case "MODEL":
            case "PURCHASE_DATE":
            case "IP":
            case "UID":
            case "NONE":
                return normalized;
            default:
                return "NONE";
        }
    }

    private List<String> buildInfoLines(List<String> fields, Uid uid, Device device, boolean includeLabel) {
        List<String> lines = new ArrayList<>(fields.size());
        Map<String, String> fieldLabelMap = new HashMap<>();
        fieldLabelMap.put("MANAGE", "관리번호");
        fieldLabelMap.put("MANUFACTURER", "제조사");
        fieldLabelMap.put("MODEL", "모델명");
        fieldLabelMap.put("PURCHASE_DATE", "도입년월");
        fieldLabelMap.put("IP", "비고");
        fieldLabelMap.put("UID", "고유번호");
        
        for (String field : fields) {
            String value = resolveFieldValue(field, uid, device);
            if (includeLabel && field != null && !"NONE".equals(field) && !value.isEmpty() && !"-".equals(value)) {
                String label = fieldLabelMap.getOrDefault(field, field);
                lines.add(label + " : " + value);
            } else {
                lines.add(value);
            }
        }
        return lines;
    }
    
    private List<String> buildInfoLines(List<String> fields, Uid uid, Device device) {
        return buildInfoLines(fields, uid, device, false); // 기본값: 라벨 없음
    }

    private String resolveFieldValue(String field, Uid uid, Device device) {
        if (field == null || "NONE".equals(field)) {
            return "";
        }

        switch (field) {
            case "MANAGE":
                if (device != null && device.getManage() != null) {
                    String manageValue = device.getManage().getDisplayId();
                    return normalizeValue(manageValue);
                }
                return "-";
            case "MANUFACTURER":
                return normalizeValue(device != null ? device.getManufacturer() : null);
            case "MODEL":
                return normalizeValue(device != null ? device.getModelName() : null);
            case "PURCHASE_DATE":
                if (device != null && device.getPurchaseDate() != null) {
                    return device.getPurchaseDate().format(PURCHASE_DATE_FORMATTER);
                }
                return "-";
            case "IP":
                // IP 주소를 변환: (제조월 - IP2번째 값의 끝 수 - IP4번째의 값)
                // 예: 10.101.36.227 → 12-1-227 (12월제품 101번대 227번 IP)
                if (device != null && device.getIpAddress() != null && !device.getIpAddress().isBlank()) {
                    String ipAddress = device.getIpAddress().trim();
                    String[] ipParts = ipAddress.split("\\.");
                    
                    if (ipParts.length >= 4) {
                        // 제조월: purchaseDate에서 월 추출
                        int month = 0;
                        if (device.getPurchaseDate() != null) {
                            month = device.getPurchaseDate().getMonthValue();
                        }
                        
                        // IP2번째 값의 끝 수
                        String ip2Str = ipParts[1];
                        int ip2LastDigit = 0;
                        if (!ip2Str.isEmpty()) {
                            ip2LastDigit = Character.getNumericValue(ip2Str.charAt(ip2Str.length() - 1));
                        }
                        
                        // IP4번째의 값
                        String ip4Str = ipParts[3];
                        
                        return String.format("%d-%d-%s", month, ip2LastDigit, ip4Str);
                    }
                }
                return "-";
            case "UID":
                if (uid.getDisplayUid() != null && !uid.getDisplayUid().isBlank()) {
                    return uid.getDisplayUid();
                }
                return normalizeValue(uid.getDisplayId());
            default:
                return "";
        }
    }

    private String normalizeValue(String value) {
        if (value == null || value.isBlank()) {
            return "-";
        }
        return value;
    }
    
    /**
     * 데이터만 포함한 엑셀 파일을 생성합니다 (A~D열에 설정 순서대로).
     * @param schoolId 학교 ID
     * @param infoFields 설정된 정보 필드 목록
     * @return 엑셀 파일의 바이트 배열
     */
    public byte[] generateDataExcel(Long schoolId, List<String> infoFields) throws IOException {
        School school = schoolService.findById(schoolId)
                .orElseThrow(() -> new RuntimeException("학교를 찾을 수 없습니다."));
        
        List<Uid> uids = uidService.getUidsBySchoolId(schoolId);
        List<String> fieldConfig = normalizeInfoFields(infoFields);
        return generateDataExcelWithUids(uids, fieldConfig);
    }
    
    /**
     * 필터링된 장비들의 데이터만 포함한 엑셀 파일을 생성합니다 (A~D열에 설정 순서대로).
     * @param schoolId 학교 ID
     * @param type 장비 유형 (선택사항)
     * @param classroomId 교실 ID (선택사항)
     * @param searchKeyword 검색 키워드 (선택사항)
     * @param infoFields 설정된 정보 필드 목록
     * @return 엑셀 파일의 바이트 배열
     */
    public byte[] generateDataExcelFiltered(Long schoolId, String type, Long classroomId, String searchKeyword, List<String> infoFields) throws IOException {
        // 필터링된 장비 목록 가져오기
        List<Device> filteredDevices;
        if (searchKeyword != null && !searchKeyword.trim().isEmpty()) {
            filteredDevices = deviceService.searchDevices(schoolId, type, classroomId, searchKeyword);
        } else {
            filteredDevices = deviceService.findFiltered(schoolId, type, classroomId);
        }
        
        // 장비들의 Uid 추출
        List<Uid> uids = filteredDevices.stream()
                .filter(device -> device.getUid() != null)
                .map(Device::getUid)
                .distinct()
                .collect(Collectors.toList());
        
        List<String> fieldConfig = normalizeInfoFields(infoFields);
        return generateDataExcelWithUids(uids, fieldConfig);
    }
    
    /**
     * Uid 리스트를 받아서 데이터 엑셀 파일을 생성합니다.
     * @param uids Uid 리스트
     * @param fieldConfig 필드 설정
     * @return 엑셀 파일의 바이트 배열
     */
    private byte[] generateDataExcelWithUids(List<Uid> uids, List<String> fieldConfig) throws IOException {
        // NONE이 아닌 필드만 추출 (최대 4개: A~D열)
        List<String> activeFields = new ArrayList<>();
        for (String field : fieldConfig) {
            if (field != null && !"NONE".equals(field) && activeFields.size() < 4) {
                activeFields.add(field);
            }
        }
        
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("데이터");
            
            CellStyle dataStyle = createDataStyle(workbook);
            
            // 열 너비 설정
            for (int i = 0; i < activeFields.size() && i < 4; i++) {
                sheet.setColumnWidth(i, 4000);
            }
            
            // 데이터 행 생성 (헤더 없이 바로 데이터부터 시작)
            for (int index = 0; index < uids.size(); index++) {
                Uid uid = uids.get(index);
                Device device = deviceRepository.findByUid(uid).orElse(null);
                
                Row dataRow = sheet.createRow(index);
                dataRow.setHeightInPoints(18f);
                
                for (int col = 0; col < activeFields.size() && col < 4; col++) {
                    String field = activeFields.get(col);
                    String value = resolveFieldValue(field, uid, device);
                    
                    Cell cell = dataRow.createCell(col);
                    cell.setCellValue(value);
                    cell.setCellStyle(dataStyle);
                }
            }
            
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            workbook.write(baos);
            return baos.toByteArray();
        }
    }
    
    /**
     * 헤더 스타일을 생성합니다.
     */
    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 12);
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }
    
    /**
     * 데이터 스타일을 생성합니다.
     */
    private CellStyle createDataStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setFontHeightInPoints((short) 11);
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setWrapText(false);
        return style;
    }
}
