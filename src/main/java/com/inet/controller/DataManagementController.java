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
                                 RedirectAttributes redirectAttributes) {
        try {
            School school = schoolService.getSchoolById(schoolId)
                .orElseThrow(() -> new IllegalArgumentException("학교를 찾을 수 없습니다."));
            
            dataManagementService.deleteSchoolData(schoolId);
            redirectAttributes.addFlashAttribute("message", 
                school.getSchoolName() + "의 데이터가 성공적으로 삭제되었습니다.");
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", 
                "데이터 삭제 중 오류가 발생했습니다: " + e.getMessage());
        }
        return "redirect:/data/delete";
    }
} 