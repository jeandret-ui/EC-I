Attribute VB_Name = "ThisWorkbook"
Attribute VB_Base = "0{00020819-0000-0000-C000-000000000046}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = True
Sub showInpuForm()
    Input_Form.Show
End Sub
Sub CopyTemplatePanelArea()
Attribute CopyTemplatePanelArea.VB_ProcData.VB_Invoke_Func = "Q\n14"
'
' CopyTemplatePanelArea Macro
'
' Keyboard Shortcut: Ctrl+Shift+Q
'
    Dim StartRow As Variant
        StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
    Dim endRow As Variant
        endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
    Dim StartCopyRow As Variant
        StartCopyRow = ThisWorkbook.Names("Start_Row_Template_Complete_Panel").RefersToRange.Value
    Dim EndCopyRow As Variant
        EndCopyRow = ThisWorkbook.Names("End_Row_Template_Complete_Panel").RefersToRange.Value
    
    Rows(StartRow & ":" & endRow).Hidden = False
    Rows(StartCopyRow & ":" & EndCopyRow).Copy
    Selection.Insert Shift:=xlDown
    Rows(StartRow & ":" & endRow).Hidden = True
End Sub
Sub CopyTemplateGeneralArea()
Attribute CopyTemplateGeneralArea.VB_ProcData.VB_Invoke_Func = "W\n14"
'
' CopyTemplateGeneralArea Macro
'
' Keyboard Shortcut: Ctrl+Shift+W
'
   Dim StartRow As Variant
        StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
    Dim endRow As Variant
        endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
    Dim StartCopyRow As Variant
        StartCopyRow = ThisWorkbook.Names("Start_Row_Template_General").RefersToRange.Value
    Dim EndCopyRow As Variant
        EndCopyRow = ThisWorkbook.Names("End_Row_Template_General").RefersToRange.Value
    
    Rows(StartRow & ":" & endRow).Hidden = False
    Rows(StartCopyRow & ":" & EndCopyRow).Copy
    Selection.Insert Shift:=xlDown
    Rows(StartRow & ":" & endRow).Hidden = True
End Sub
Sub CopyTemplatePGArea()
Attribute CopyTemplatePGArea.VB_ProcData.VB_Invoke_Func = "E\n14"
'
' CopyTemplatePGArea
'
' Keyboard Shortcut: Ctrl+Shift+E

    Dim StartRow As Variant
        StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
    Dim endRow As Variant
        endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
    Dim StartCopyRow As Variant
        StartCopyRow = ThisWorkbook.Names("Start_Row_Template_PGs").RefersToRange.Value
    Dim EndCopyRow As Variant
        EndCopyRow = ThisWorkbook.Names("End_Row_Template_PGs").RefersToRange.Value
    
    Rows(StartRow & ":" & endRow).Hidden = False
    Rows(StartCopyRow & ":" & EndCopyRow).Copy
    Selection.Insert Shift:=xlDown
    Rows(StartRow & ":" & endRow).Hidden = True
End Sub
Sub CopyTemplateServiceArea()
Attribute CopyTemplateServiceArea.VB_ProcData.VB_Invoke_Func = "R\n14"
'
' CopyTemplateServiceArea
'
' Keyboard Shortcut: Ctrl+Shift+R

    Dim StartRow As Variant
        StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
    Dim endRow As Variant
        endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
    Dim StartCopyRow As Variant
        StartCopyRow = ThisWorkbook.Names("Start_Row_Template_Services").RefersToRange.Value
    Dim EndCopyRow As Variant
        EndCopyRow = ThisWorkbook.Names("End_Row_Template_Services").RefersToRange.Value
    
    Rows(StartRow & ":" & endRow).Hidden = False
    Rows(StartCopyRow & ":" & EndCopyRow).Copy
    Selection.Insert Shift:=xlDown
    Rows(StartRow & ":" & endRow).Hidden = True
End Sub
Sub CopyLevel3Area()
'
' CopyLevel3Area
'
' Keyboard Shortcut: Ctrl+Shift+T

    Dim StartRow As Variant
        StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
    Dim endRow As Variant
        endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
    Dim StartCopyRow As Variant
        StartCopyRow = ThisWorkbook.Names("Start_Row_Template_Level3").RefersToRange.Value
    Dim EndCopyRow As Variant
        EndCopyRow = ThisWorkbook.Names("End_Row_Template_Level3").RefersToRange.Value
    
    Rows(StartRow & ":" & endRow).Hidden = False
    Rows(StartCopyRow & ":" & EndCopyRow).Copy
    Selection.Insert Shift:=xlDown
    Rows(StartRow & ":" & endRow).Hidden = True
End Sub
Sub NewMaterialRatesLine()
Attribute NewMaterialRatesLine.VB_ProcData.VB_Invoke_Func = "A\n14"
'
' NewMaterialRatesLine Macro
'
' Keyboard Shortcut: Ctrl+Shift+A

   Dim StartRow As Variant
        StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
    Dim endRow As Variant
        endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
    Dim StartCopyRow As Variant
        StartCopyRow = ThisWorkbook.Names("Row_Template_MR").RefersToRange.Value
    Dim EndCopyRow As Variant
        EndCopyRow = ThisWorkbook.Names("Row_Template_MR").RefersToRange.Value
    
    Rows(StartRow & ":" & endRow).Hidden = False
    Rows(StartCopyRow & ":" & EndCopyRow).Copy
    Selection.Insert Shift:=xlDown
    Rows(StartRow & ":" & endRow).Hidden = True
End Sub
Sub NewMaretialManualLine()
Attribute NewMaretialManualLine.VB_ProcData.VB_Invoke_Func = "S\n14"
'
' NewMaterialManualLine Macro
'
' Keyboard Shortcut: Ctrl+Shift+S

    Dim StartRow As Variant
        StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
    Dim endRow As Variant
        endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
    Dim StartCopyRow As Variant
        StartCopyRow = ThisWorkbook.Names("Row_Template_MM").RefersToRange.Value
    Dim EndCopyRow As Variant
        EndCopyRow = ThisWorkbook.Names("Row_Template_MM").RefersToRange.Value
    
    Rows(StartRow & ":" & endRow).Hidden = False
    Rows(StartCopyRow & ":" & EndCopyRow).Copy
    Selection.Insert Shift:=xlDown
    Rows(StartRow & ":" & endRow).Hidden = True
End Sub
Sub NewLabourManualLine()
Attribute NewLabourManualLine.VB_ProcData.VB_Invoke_Func = "F\n14"
'
' NewLabourManualLine Macro
'
' Keyboard Shortcut: Ctrl+Shift+D

    Dim StartRow As Variant
        StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
    Dim endRow As Variant
        endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
    Dim StartCopyRow As Variant
        StartCopyRow = ThisWorkbook.Names("Row_Template_LM").RefersToRange.Value
    Dim EndCopyRow As Variant
        EndCopyRow = ThisWorkbook.Names("Row_Template_LM").RefersToRange.Value
    
    Rows(StartRow & ":" & endRow).Hidden = False
    Rows(StartCopyRow & ":" & EndCopyRow).Copy
    Selection.Insert Shift:=xlDown
    Rows(StartRow & ":" & endRow).Hidden = True
End Sub
Sub NewLabourRatesLine()
Attribute NewLabourRatesLine.VB_ProcData.VB_Invoke_Func = "D\n14"
'
' NewLabourRatesLine Macro
'
' Keyboard Shortcut: Ctrl+Shift+F

    Dim StartRow As Variant
        StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
    Dim endRow As Variant
        endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
    Dim StartCopyRow As Variant
        StartCopyRow = ThisWorkbook.Names("Row_Template_LR").RefersToRange.Value
    Dim EndCopyRow As Variant
        EndCopyRow = ThisWorkbook.Names("Row_Template_LR").RefersToRange.Value
    
    Rows(StartRow & ":" & endRow).Hidden = False
    Rows(StartCopyRow & ":" & EndCopyRow).Copy
    Selection.Insert Shift:=xlDown
    Rows(StartRow & ":" & endRow).Hidden = True
End Sub
Sub CopyTemplateMain()
Attribute CopyTemplateMain.VB_ProcData.VB_Invoke_Func = "T\n14"
'
' CopyTemplateMain Macro
'
' Keyboard Shortcut: Ctrl+Shift+T
'
    Dim StartRow As Variant
        StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
    Dim endRow As Variant
        endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
    Dim StartCopyRow As Variant
        StartCopyRow = ThisWorkbook.Names("Start_Row_Template_Main").RefersToRange.Value
    Dim EndCopyRow As Variant
        EndCopyRow = ThisWorkbook.Names("End_Row_Template_Main").RefersToRange.Value
    
    Rows(StartRow & ":" & endRow).Hidden = False
    Rows(StartCopyRow & ":" & EndCopyRow).Copy
    Selection.Insert Shift:=xlDown
    Rows(StartRow & ":" & endRow).Hidden = True
End Sub
Sub NewAdditionalCaptureLine()
Attribute NewAdditionalCaptureLine.VB_ProcData.VB_Invoke_Func = "G\n14"
'
' NewACLine Macro
'
     Dim StartRow As Variant
        StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
    Dim endRow As Variant
        endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
    Dim StartCopyRow As Variant
        StartCopyRow = ThisWorkbook.Names("Row_Template_AC").RefersToRange.Value
    Dim EndCopyRow As Variant
        EndCopyRow = ThisWorkbook.Names("Row_Template_AC").RefersToRange.Value
    
    Rows(StartRow & ":" & endRow).Hidden = False
    Rows(StartCopyRow & ":" & EndCopyRow).Copy
    Selection.Insert Shift:=xlDown
    Rows(StartRow & ":" & endRow).Hidden = True
End Sub
Sub NewLevel1()
'
' NewLevel1 Macro
'
    Dim StartRow As Variant
        StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
    Dim endRow As Variant
        endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
    Dim StartCopyRow As Variant
        StartCopyRow = ThisWorkbook.Names("Start_Row_Template_Level1").RefersToRange.Value
    Dim EndCopyRow As Variant
        EndCopyRow = ThisWorkbook.Names("End_Row_Template_Level1").RefersToRange.Value
    
    Rows(StartRow & ":" & endRow).Hidden = False
    Rows(StartCopyRow & ":" & EndCopyRow).Copy
    Selection.Insert Shift:=xlDown
    Rows(StartRow & ":" & endRow).Hidden = True
End Sub

Sub NewLevel2()
'
' NewLevel2 Macro
'
     Dim StartRow As Variant
        StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
    Dim endRow As Variant
        endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
    Dim StartCopyRow As Variant
        StartCopyRow = ThisWorkbook.Names("Start_Row_Template_Level2").RefersToRange.Value
    Dim EndCopyRow As Variant
        EndCopyRow = ThisWorkbook.Names("End_Row_Template_Level2").RefersToRange.Value
    
    Rows(StartRow & ":" & endRow).Hidden = False
    Rows(StartCopyRow & ":" & EndCopyRow).Copy
    Selection.Insert Shift:=xlDown
    Rows(StartRow & ":" & endRow).Hidden = True
End Sub

Sub NewLevel3()
'
' NewLevel3 Macro
'
     Dim StartRow As Variant
        StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
    Dim endRow As Variant
        endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
    Dim StartCopyRow As Variant
        StartCopyRow = ThisWorkbook.Names("Start_Row_Template_Level3").RefersToRange.Value
    Dim EndCopyRow As Variant
        EndCopyRow = ThisWorkbook.Names("End_Row_Template_Level3").RefersToRange.Value
    
    Rows(StartRow & ":" & endRow).Hidden = False
    Rows(StartCopyRow & ":" & EndCopyRow).Copy
    Selection.Insert Shift:=xlDown
    Rows(StartRow & ":" & endRow).Hidden = True
End Sub

Private Sub Workbook_BeforePrint(Cancel As Boolean)
    Module1.Hide_TC_Rows
End Sub

Private Sub Workbook_Open()
    'Input_Form.Show
End Sub


Private Sub Workbook_WindowActivate(ByVal Wn As Window)
    ' Code to run when any window is activated
    ' Check if the active window is a print preview window
    If InStr(1, Wn.Caption, "Print preview", vbTextCompare) > 0 Then
        ' Code to run just before print preview is shown
        MsgBox "Executing code just before print preview"
    End If
End Sub

Sub Print_Start()
    Dim x As Variant
    
    Call Sheet8.CheckTotals
    
    If Sheet8.tMatch = False Then
        Call Sheet8.Insert_CF
    End If
    
    x = Array("T&C", "COSTING", "T&C Standard")
    Module1.Hide_TC_Rows
    Module1.Hide_TCStandard_Rows
    Sheets(x).PrintPreview
    Sheets(x(2)).Select
    Sheets(x(1)).Select
    Sheets(x(0)).Select
End Sub





