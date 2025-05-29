package com.inet.controller;

import com.inet.service.WirelessApService;
import com.inet.service.SchoolService;
import com.inet.entity.School;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/wireless-ap/upload")
@RequiredArgsConstructor
public class WirelessApUploadController {
    private final WirelessApService wirelessApService;
    private final SchoolService schoolService;

    @GetMapping
    public String showUploadForm(Model model) {
        model.addAttribute("schools", schoolService.getAllSchools());
        return "wireless-ap/upload";
    }

    @PostMapping
    public String handleFileUpload(@RequestParam("file") MultipartFile file,
                                 @RequestParam("schoolId") Long schoolId,
                                 RedirectAttributes redirectAttributes) {
        try {
            School school = schoolService.getSchoolById(schoolId)
                    .orElseThrow(() -> new IllegalArgumentException("선택된 학교를 찾을 수 없습니다."));
            
            wirelessApService.saveWirelessApsFromExcel(file, school);
            redirectAttributes.addFlashAttribute("message", "무선 AP 업로드 성공!");
        } catch (IllegalArgumentException e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", "업로드 중 오류가 발생했습니다: " + e.getMessage());
        }
        return "redirect:/wireless-ap/upload";
    }
} 