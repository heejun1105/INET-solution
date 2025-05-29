package com.inet.controller;

import com.inet.service.DataManagementService;
import com.inet.service.SchoolService;
import com.inet.entity.School;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.ArrayList;
import java.util.List;

@Controller
@RequestMapping("/data")
public class DataManagementController {
    
    private final SchoolService schoolService;
    private final DataManagementService dataManagementService;

    @Autowired
    public DataManagementController(SchoolService schoolService, DataManagementService dataManagementService) {
        this.schoolService = schoolService;
        this.dataManagementService = dataManagementService;
    }

    @GetMapping("/delete")
    public String showDeleteForm(Model model) {
        model.addAttribute("schools", schoolService.getAllSchools());
        return "data/delete";
    }

    @PostMapping("/delete")
    public String deleteSchoolData(@RequestParam("schoolId") Long schoolId, 
                                 @RequestParam(value = "deleteType", required = false) String deleteType,
                                 @RequestParam(value = "deleteDevices", required = false) boolean deleteDevices,
                                 @RequestParam(value = "deleteWirelessAps", required = false) boolean deleteWirelessAps,
                                 @RequestParam(value = "deleteClassrooms", required = false) boolean deleteClassrooms,
                                 @RequestParam(value = "deleteOperators", required = false) boolean deleteOperators,
                                 @RequestParam(value = "deleteManages", required = false) boolean deleteManages,
                                 @RequestParam(value = "deleteUids", required = false) boolean deleteUids,
                                 RedirectAttributes redirectAttributes) {
        try {
            School school = schoolService.getSchoolById(schoolId)
                .orElseThrow(() -> new IllegalArgumentException("학교를 찾을 수 없습니다."));
            
            String message = "";
            
            if ("all".equals(deleteType)) {
                // 전체 데이터 삭제 (기존 기능)
                dataManagementService.deleteSchoolData(schoolId);
                message = school.getSchoolName() + "의 모든 데이터가 성공적으로 삭제되었습니다.";
            } else if ("selective".equals(deleteType)) {
                // 선택적 삭제
                if (!deleteDevices && !deleteWirelessAps && !deleteClassrooms && 
                    !deleteOperators && !deleteManages && !deleteUids) {
                    redirectAttributes.addFlashAttribute("error", 
                        "삭제할 데이터 유형을 하나 이상 선택해주세요.");
                    return "redirect:/data/delete";
                }
                
                dataManagementService.deleteSelectedDataTypes(schoolId, deleteDevices, deleteWirelessAps, 
                                                             deleteClassrooms, deleteOperators, deleteManages, deleteUids);
                
                // 선택된 데이터 유형들을 메시지로 구성
                StringBuilder messageBuilder = new StringBuilder(school.getSchoolName() + "의 ");
                List<String> dataTypes = new ArrayList<>();
                if (deleteDevices) dataTypes.add("장비");
                if (deleteWirelessAps) dataTypes.add("무선 AP");
                if (deleteClassrooms) dataTypes.add("교실");
                if (deleteOperators) dataTypes.add("운영자");
                if (deleteManages) dataTypes.add("관리");
                if (deleteUids) dataTypes.add("UID");
                
                messageBuilder.append(String.join(", ", dataTypes));
                messageBuilder.append(" 데이터가 성공적으로 삭제되었습니다.");
                message = messageBuilder.toString();
            } else {
                redirectAttributes.addFlashAttribute("error", 
                    "삭제 유형을 선택해주세요.");
                return "redirect:/data/delete";
            }
            
            redirectAttributes.addFlashAttribute("message", message);
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", 
                "데이터 삭제 중 오류가 발생했습니다: " + e.getMessage());
        }
        return "redirect:/data/delete";
    }
} 