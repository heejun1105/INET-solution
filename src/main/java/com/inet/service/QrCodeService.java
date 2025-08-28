package com.inet.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.inet.entity.School;
import com.inet.entity.Uid;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class QrCodeService {
    
    @Autowired
    private UidService uidService;
    
    @Autowired
    private SchoolService schoolService;
    
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
    public byte[] generateQrCodeExcel(Long schoolId) throws IOException, WriterException {
        School school = schoolService.findById(schoolId)
                .orElseThrow(() -> new RuntimeException("학교를 찾을 수 없습니다."));
        
        List<Uid> uids = uidService.getUidsBySchoolId(schoolId);
        
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("QR코드");
            
            // 스타일 설정
            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle titleStyle = createTitleStyle(workbook);
            CellStyle uidStyle = createUidStyle(workbook);
            
            // 학교 이름 (상단)
            Row titleRow = sheet.createRow(0);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue(school.getSchoolName());
            titleCell.setCellStyle(titleStyle);
            
            // 제목 행
            Row headerRow = sheet.createRow(2);
            String[] headers = {"고유번호", "QR코드"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }
            
            // 데이터 행 - 가로 5개씩 배치
            int rowNum = 3;
            int colOffset = 0;
            
            for (int i = 0; i < uids.size(); i++) {
                Uid uid = uids.get(i);
                
                // 5개마다 새로운 행 시작
                if (i % 5 == 0) {
                    rowNum = 3 + (i / 5) * 3; // 3행 간격으로 배치
                    colOffset = 0;
                }
                
                Row row = sheet.getRow(rowNum);
                if (row == null) {
                    row = sheet.createRow(rowNum);
                }
                
                // 고유번호
                Cell uidCell = row.createCell(colOffset * 2);
                uidCell.setCellValue(uid.getDisplayUid() != null ? uid.getDisplayUid() : uid.getDisplayId());
                uidCell.setCellStyle(uidStyle);
                
                // QR 코드 셀 (테두리용)
                Cell qrCell = row.createCell(colOffset * 2 + 1);
                qrCell.setCellStyle(uidStyle); // 고유번호와 동일한 테두리 스타일 적용
                
                // QR 코드 이미지
                if (uid.getDisplayUid() != null && !uid.getDisplayUid().isEmpty()) {
                    // 1cm = 약 38픽셀 (96 DPI 기준)
                    byte[] qrCodeBytes = generateQrCode(uid.getDisplayUid(), 38);
                    int pictureIndex = workbook.addPicture(qrCodeBytes, Workbook.PICTURE_TYPE_PNG);
                    
                    CreationHelper helper = workbook.getCreationHelper();
                    ClientAnchor anchor = helper.createClientAnchor();
                    anchor.setCol1(colOffset * 2 + 1);
                    anchor.setRow1(rowNum);
                    anchor.setCol2(colOffset * 2 + 2);
                    anchor.setRow2(rowNum + 1);
                    
                    Drawing<?> drawing = sheet.createDrawingPatriarch();
                    drawing.createPicture(anchor, pictureIndex);
                }
                
                colOffset++;
            }
            
            // 열 너비 설정 (A4 용지에 맞춤, 5개 배치)
            sheet.setColumnWidth(0, 2000); // 첫 번째 고유번호 열
            sheet.setColumnWidth(1, 1500); // 첫 번째 QR코드 열
            sheet.setColumnWidth(2, 2000); // 두 번째 고유번호 열
            sheet.setColumnWidth(3, 1500); // 두 번째 QR코드 열
            sheet.setColumnWidth(4, 2000); // 세 번째 고유번호 열
            sheet.setColumnWidth(5, 1500); // 세 번째 QR코드 열
            sheet.setColumnWidth(6, 2000); // 네 번째 고유번호 열
            sheet.setColumnWidth(7, 1500); // 네 번째 QR코드 열
            sheet.setColumnWidth(8, 2000); // 다섯 번째 고유번호 열
            sheet.setColumnWidth(9, 1500); // 다섯 번째 QR코드 열
            
            // 행 높이 설정 (QR 코드 크기에 맞춤)
            for (int i = 3; i < rowNum + 3; i++) {
                Row row = sheet.getRow(i);
                if (row != null) {
                    row.setHeight((short) 1200); // 약 1cm
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
        font.setFontHeightInPoints((short) 8); // 고유번호와 동일한 크기로 조정
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
     * 제목 스타일을 생성합니다.
     */
    private CellStyle createTitleStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 8); // 고유번호와 동일한 크기로 조정
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
}
