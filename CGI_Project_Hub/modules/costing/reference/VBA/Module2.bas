Attribute VB_Name = "Module2"

Sub Show_All_Columns()
Attribute Show_All_Columns.VB_ProcData.VB_Invoke_Func = " \n14"
'
' Show_All_Columns Macro
'

'
    Columns("A:JX").Select
    Selection.EntireColumn.Hidden = False
End Sub

Sub Print_Rows_Show()
Attribute Print_Rows_Show.VB_ProcData.VB_Invoke_Func = " \n14"
'
' Print_Rows_Show Macro
'

'
    ActiveSheet.Range("$B$13:$DO$171").AutoFilter Field:=1
End Sub
Sub Print_Rows_Hide()
'
' Print_Rows_Hide Macro
'

'
    ActiveSheet.Range("$B$13:$DO$171").AutoFilter Field:=1, Criteria1:="Show"
End Sub

Sub Invoice_Rows_Show()
'
' Print_Rows_Show Macro
'

'
    ActiveSheet.Range("$D$13:$DO$171").AutoFilter Field:=3
End Sub
Sub Invoice_Rows_Hide()
'
' Print_Rows_Hide Macro
'

'
    ActiveSheet.Range("$D$13:$DO$171").AutoFilter Field:=3, Criteria1:="Show"
End Sub

Sub Hide_Template_Area()
Attribute Hide_Template_Area.VB_ProcData.VB_Invoke_Func = " \n14"
'
' Hide_Template_Area Macro
'
Dim StartRow As Variant
    StartRow = ThisWorkbook.Names("Start_Row_Template").RefersToRange.Value
Dim endRow As Variant
    endRow = ThisWorkbook.Names("End_Row_Template").RefersToRange.Value
'
    Rows(StartRow & ":" & endRow).Select
    Selection.EntireRow.Hidden = True
End Sub


'Sub Hide_Show_Columns()
'
' Hide_Show_Columns Macro
'

'Range("A:FS").Select
' Selection.EntireColumn.Hidden = False
    
'Dim p As Integer
'For p = 24 To 175
'  If Cells(1, p).Value = "Hide" Then
'    Columns(p).Hidden = True
'  End If
'  Next p
'End Sub


Sub Hide_Show_Columns()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("COSTING") ' Change "Sheet1" to your sheet's name

    ' Define your defined names
    Dim startColName As String
    Dim endColName As String
    startColName = "Start_Column_Data" ' Replace with the name of your defined name for the starting column
    endColName = "End_Column_Data"     ' Replace with the name of your defined name for the ending column

    ' Get the column numbers based on the defined names
    Dim StartCol As Integer
    Dim endCol As Integer

    On Error Resume Next
    StartCol = ThisWorkbook.Names(startColName).RefersToRange.Column
    endCol = ThisWorkbook.Names(endColName).RefersToRange.Column
    On Error GoTo 0

    ' Check if the defined names exist and continue with the code
    If StartCol = 0 Or endCol = 0 Then
        MsgBox "One or both of the defined names do not exist on the specified worksheet."
        Exit Sub
    End If

    ' Unhide all columns within the specified range
    Range(StartCol & ":" & endCol).Select
    Selection.EntireColumn.Hidden = False
    

Dim StartColumn As Variant
    StartColumn = ThisWorkbook.Names("Start_Column_Data_Number").RefersToRange.Value
Dim EndColumn As Variant
    EndColumn = ThisWorkbook.Names("End_Column_Data_Number").RefersToRange.Value    ' Iterate through the columns to hide those with a "Hide" value in the first row
    Application.Calculation = xlCalculationManual
   For p = StartColumn To EndColumn
'    For p = 24 To 185
        If ws.Cells(1, p).Value = "Hide" Then
            ws.Columns(p).EntireColumn.Hidden = True
        End If
    Next p
    Application.Calculation = xlCalculationAutomatic
End Sub

