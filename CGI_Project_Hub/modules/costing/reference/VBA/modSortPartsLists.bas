Attribute VB_Name = "modSortPartsLists"
Public Sub SortTableAlphabetically()
    Dim wsRates As Worksheet
    Dim tblParts As ListObject
    Dim tblRates As ListObject

    ' Set the worksheet and table
    Set wsRates = ThisWorkbook.Sheets("RATES REFRESH")
    Set tblParts = wsRates.ListObjects("tblParts")
    Set tblRates = wsRates.ListObjects("tblFixed")
    
    ' Clear any existing sorts, set the column to sort by, and apply
    With tblParts.Sort
        .SortFields.Clear
        .SortFields.Add2 Key:=tblParts.ListColumns("Category 1").Range, _
                         SortOn:=xlSortOnValues, _
                         Order:=xlAscending, _
                         DataOption:=xlSortNormal
        .Header = xlYes
        .MatchCase = False
        .Apply
    End With
    
    ' Clear any existing sorts, set the column to sort by, and apply
    With tblRates.Sort
        .SortFields.Clear
        .SortFields.Add2 Key:=tblRates.ListColumns("Category 1").Range, _
                         SortOn:=xlSortOnValues, _
                         Order:=xlAscending, _
                         DataOption:=xlSortNormal
        .Header = xlYes
        .MatchCase = False
        .Apply
    End With

End Sub


